// Channel management: real availability push to OTAs
// Booking.com, Airbnb, Expedia, Agoda, Vrbo, Hotels.com use iCal/Channel Manager APIs.
// We implement a working channel push that posts availability updates to configured
// external endpoints (which would be the real channel manager's webhook in production).

import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/api';

export type ChannelSyncResult = {
  ok: boolean;
  pushed: number;
  failed: number;
  duration: number;
  details: { unitId: string; externalId: string; status: string; message?: string }[];
};

/**
 * Push availability to a channel endpoint.
 * In production this would call the OTA's real API. For now, it POSTs to a
 * configured syncUrl (which is what real channel managers expose) with the
 * availability payload.
 */
export async function pushChannelAvailability(opts: {
  organizationId: string;
  channelId: string;
  channelName: string;
  syncUrl: string;
  channelType: string;
  units: { unitId: string; externalId: string; number: string; name: string; status: string }[];
  dateFrom: Date;
  dateTo: Date;
}): Promise<ChannelSyncResult> {
  const start = Date.now();
  const result: ChannelSyncResult = { ok: true, pushed: 0, failed: 0, duration: 0, details: [] };

  if (!opts.syncUrl) {
    return { ...result, ok: false, duration: Date.now() - start, details: [{ unitId: '', externalId: '', status: 'failed', message: 'No sync URL configured' }] };
  }

  // Fetch booked dates for the period
  const bookings = await prisma.booking.findMany({
    where: {
      organizationId: opts.organizationId,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      arrivalDate: { lte: opts.dateTo },
      departureDate: { gte: opts.dateFrom },
      unitId: { not: null },
    },
    select: { unitId: true, arrivalDate: true, departureDate: true, confirmationCode: true },
  });

  // Build availability map: for each unit, mark each date as available/booked
  const unitAvailability: Record<string, { number: string; name: string; externalId: string; days: { date: string; available: boolean; bookingCode?: string }[] }> = {};
  const days: string[] = [];
  for (let d = new Date(opts.dateFrom); d <= opts.dateTo; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  for (const u of opts.units) {
    unitAvailability[u.unitId] = { number: u.number, name: u.name, externalId: u.externalId, days: [] };
    for (const day of days) {
      const dayDate = new Date(day);
      const booking = bookings.find((b) => b.unitId === u.unitId && new Date(b.arrivalDate) <= dayDate && new Date(b.departureDate) > dayDate);
      unitAvailability[u.unitId].days.push({
        date: day,
        available: !booking,
        bookingCode: booking?.confirmationCode,
      });
    }
  }

  // Push to the channel endpoint
  const payload = {
    source: 'pms',
    channelType: opts.channelType,
    channelName: opts.channelName,
    syncedAt: new Date().toISOString(),
    dateRange: { from: opts.dateFrom.toISOString().slice(0, 10), to: opts.dateTo.toISOString().slice(0, 10) },
    units: Object.entries(unitAvailability).map(([unitId, data]) => ({
      unitId, externalId: data.externalId, number: data.number, name: data.name, days: data.days,
    })),
  };

  try {
    const res = await fetch(opts.syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PMS-Source': 'pms-channel-manager', 'X-PMS-Channel': opts.channelType },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const responseBody = await res.text().catch(() => '');

    for (const u of opts.units) {
      const status = res.ok ? 'success' : 'failed';
      if (res.ok) result.pushed++;
      else result.failed++;
      result.details.push({
        unitId: u.unitId,
        externalId: u.externalId,
        status,
        message: res.ok ? undefined : `HTTP ${res.status}: ${responseBody.slice(0, 200)}`,
      });
    }
    result.ok = res.ok;
    result.duration = Date.now() - start;

    // Log the sync
    await prisma.channelSyncLog.create({
      data: {
        channelId: opts.channelId,
        action: 'AVAILABILITY_PUSH',
        entity: 'Channel',
        entityId: opts.channelId,
        status: res.ok ? 'SUCCESS' : 'FAILED',
        message: res.ok ? `Pushed availability for ${opts.units.length} units across ${days.length} days` : `HTTP ${res.status}`,
        payload: { pushed: result.pushed, failed: result.failed, days: days.length },
      },
    });

    if (res.ok) {
      await prisma.channel.update({
        where: { id: opts.channelId },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', errorCount: 0 },
      });
    } else {
      await prisma.channel.update({
        where: { id: opts.channelId },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'FAILED', errorCount: { increment: 1 } },
      });
    }
  } catch (e: any) {
    result.ok = false;
    result.duration = Date.now() - start;
    const message = e?.message || 'Network error';
    for (const u of opts.units) {
      result.failed++;
      result.details.push({ unitId: u.unitId, externalId: u.externalId, status: 'failed', message });
    }
    await prisma.channelSyncLog.create({
      data: {
        channelId: opts.channelId, action: 'AVAILABILITY_PUSH', entity: 'Channel', entityId: opts.channelId,
        status: 'FAILED', message, payload: { error: message },
      },
    });
    await prisma.channel.update({
      where: { id: opts.channelId },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'FAILED', errorCount: { increment: 1 } },
    });
  }

  return result;
}

/**
 * Pull reservations from a channel endpoint (e.g. new booking from Booking.com).
 * Posts to the syncUrl with an action=request and parses the response.
 */
export async function pullChannelReservations(opts: {
  organizationId: string;
  channelId: string;
  syncUrl: string;
  channelType: string;
  since: Date;
}): Promise<{ ok: boolean; fetched: number; newBookings: number; duration: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(opts.syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PMS-Source': 'pms-channel-manager', 'X-PMS-Action': 'pull' },
      body: JSON.stringify({ action: 'pull', since: opts.since.toISOString(), channelType: opts.channelType }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      await prisma.channelSyncLog.create({
        data: { channelId: opts.channelId, action: 'RESERVATION_PULL', entity: 'Channel', entityId: opts.channelId, status: 'FAILED', message: `HTTP ${res.status}` },
      });
      return { ok: false, fetched: 0, newBookings: 0, duration: Date.now() - start, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const reservations = Array.isArray(data?.reservations) ? data.reservations : [];
    let newBookings = 0;
    for (const r of reservations) {
      // Check if already imported
      const existing = await prisma.booking.findFirst({
        where: { organizationId: opts.organizationId, confirmationCode: r.confirmationCode },
      });
      if (existing) continue;
      // Create new booking from channel data
      const guest = await prisma.guest.upsert({
        where: { id: `ch-${opts.channelType}-${r.guestEmail || r.confirmationCode}` },
        update: {},
        create: {
          id: `ch-${opts.channelType}-${r.guestEmail || r.confirmationCode}`,
          organizationId: opts.organizationId,
          firstName: r.guestFirstName || 'Channel',
          lastName: r.guestLastName || 'Guest',
          email: r.guestEmail,
          phone: r.guestPhone,
          country: r.guestCountry,
        },
      });
      await prisma.booking.create({
        data: {
          organizationId: opts.organizationId,
          propertyId: r.propertyId,
          unitId: r.unitId,
          guestId: guest.id,
          confirmationCode: r.confirmationCode,
          status: 'CONFIRMED',
          source: opts.channelType as any,
          arrivalDate: new Date(r.arrivalDate),
          departureDate: new Date(r.departureDate),
          nights: Math.round((new Date(r.departureDate).getTime() - new Date(r.arrivalDate).getTime()) / 86400000),
          adults: r.adults || 1,
          children: r.children || 0,
          unitRate: r.rate || 0,
          totalAmount: r.total || 0,
          taxAmount: 0,
          discount: 0,
          paidAmount: 0,
          balance: r.total || 0,
          currency: r.currency || 'INR',
          specialRequests: r.notes,
        },
      });
      newBookings++;
    }
    await prisma.channelSyncLog.create({
      data: {
        channelId: opts.channelId, action: 'RESERVATION_PULL', entity: 'Channel', entityId: opts.channelId,
        status: 'SUCCESS', message: `Fetched ${reservations.length}, imported ${newBookings} new`,
        payload: { fetched: reservations.length, imported: newBookings },
      },
    });
    await prisma.channel.update({
      where: { id: opts.channelId },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', errorCount: 0 },
    });
    return { ok: true, fetched: reservations.length, newBookings, duration: Date.now() - start };
  } catch (e: any) {
    const message = e?.message || 'Network error';
    await prisma.channelSyncLog.create({
      data: { channelId: opts.channelId, action: 'RESERVATION_PULL', entity: 'Channel', entityId: opts.channelId, status: 'FAILED', message },
    });
    return { ok: false, fetched: 0, newBookings: 0, duration: Date.now() - start, error: message };
  }
}
