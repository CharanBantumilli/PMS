import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { bookingSchema } from '@/lib/validators';
import { nightsBetween, generateCode } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const bookings = await prisma.booking.findMany({
    where: { organizationId: ctx.organizationId, ...(status ? { status: status as any } : {}) },
    include: { guest: true, unit: true, property: true, ratePlan: true },
    orderBy: { arrivalDate: 'desc' },
    take: 200,
  });
  return jsonOk(bookings);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;

  const guest = await prisma.guest.findFirst({ where: { id: d.guestId, organizationId: ctx.organizationId } });
  if (!guest) return jsonError('Invalid guest', 400);
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });
  const property = await prisma.property.findFirst({ where: { id: d.propertyId, organizationId: ctx.organizationId } });
  if (!property) return jsonError('Invalid property', 400);
  if (d.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: d.unitId, organizationId: ctx.organizationId, propertyId: d.propertyId } });
    if (!u) return jsonError('Invalid unit for property', 400);
  }

  const nights = nightsBetween(d.arrivalDate, d.departureDate);
  if (nights < 1) return jsonError('Departure must be after arrival', 400);

  const subtotal = nights * d.unitRate;
  const total = Math.max(0, subtotal - d.discount + d.taxAmount);

  // Availability check
  if (d.unitId) {
    const conflict = await prisma.booking.findFirst({
      where: {
        organizationId: ctx.organizationId, unitId: d.unitId, status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] },
        AND: [
          { arrivalDate: { lt: new Date(d.departureDate) } },
          { departureDate: { gt: new Date(d.arrivalDate) } },
        ],
      },
    });
    if (conflict) return jsonError('Unit is not available for the selected dates', 409);
  }

  const booking = await prisma.booking.create({
    data: {
      organizationId: ctx.organizationId,
      propertyId: d.propertyId,
      unitId: d.unitId || null,
      guestId: d.guestId,
      ratePlanId: d.ratePlanId || null,
      createdById: ctx.userId,
      confirmationCode: generateCode('B', 8),
      status: d.status,
      canceledAt: d.status === 'CANCELED' ? new Date() : null,
      source: d.source,
      arrivalDate: new Date(d.arrivalDate),
      departureDate: new Date(d.departureDate),
      nights,
      adults: d.adults,
      children: d.children,
      infants: d.infants ?? 0,
      pets: 0,
      unitRate: d.unitRate,
      totalAmount: total,
      taxAmount: d.taxAmount,
      discount: d.discount,
      paidAmount: 0,
      balance: total,
      currency: org?.currency || 'INR',
      specialRequests: d.specialRequests,
      internalNotes: d.internalNotes,
    },
  });

  if (d.unitId && d.status === 'CHECKED_IN') {
    await prisma.unit.update({ where: { id: d.unitId }, data: { status: 'OCCUPIED_CLEAN' } });
  } else if (d.unitId && (d.status === 'CONFIRMED' || d.status === 'PENDING')) {
    await prisma.unit.update({ where: { id: d.unitId }, data: { status: 'VACANT_CLEAN' } }).catch(() => {});
  }

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'BOOKING_CREATE', entity: 'Booking', entityId: booking.id, description: `Created booking ${booking.confirmationCode}` });

  // Notify managers and receptionists about the new booking
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    const guest = await prisma.guest.findUnique({ where: { id: d.guestId } });
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      type: 'BOOKING_NEW',
      title: 'New booking',
      message: `${guest?.firstName} ${guest?.lastName} · ${nights} night${nights !== 1 ? 's' : ''} · ${booking.confirmationCode} · ${d.adults + d.children} guest${d.adults + d.children !== 1 ? 's' : ''}`,
      priority: 'NORMAL',
      entity: 'Booking',
      entityId: booking.id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
      metadata: { confirmationCode: booking.confirmationCode, total, nights },
    });

    // Send WhatsApp confirmation to the guest (if phone on file and WhatsApp is configured)
    if (guest?.phone) {
      try {
        const { sendWhatsAppViaOrgConfig, WHATSAPP_TEMPLATES } = await import('@/lib/whatsapp');
        const arrivalStr = new Date(d.arrivalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const departureStr = new Date(d.departureDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const totalStr = `INR ${Number(total).toLocaleString('en-IN')}`;
        await sendWhatsAppViaOrgConfig({
          organizationId: ctx.organizationId,
          to: guest.phone,
          templateName: WHATSAPP_TEMPLATES.BOOKING_CONFIRMATION,
          variables: [
            guest.firstName,
            booking.confirmationCode,
            arrivalStr,
            departureStr,
            totalStr,
          ],
        });
      } catch (e) {
        console.error('WhatsApp send error:', e);
      }
    }
  } catch (e) {
    console.error('notification error', e);
  }

  return jsonOk(booking, 201);
}
