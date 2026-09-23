import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { bookingSchema } from '@/lib/validators';
import { nightsBetween, generateCode } from '@/lib/utils';
import { calculateRate } from '@/lib/rate-engine';
import { parsePagination, paginatedOk } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const pagination = parsePagination(req);
  const where: any = { organizationId: ctx.organizationId, deletedAt: null };
  if (status) where.status = status;
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { guest: true, unit: true, property: true, ratePlan: true },
      orderBy: { arrivalDate: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.booking.count({ where }),
  ]);
  return jsonOk(paginatedOk(bookings, total, pagination));
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
  let unitTypeId: string | null = null;
  if (d.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: d.unitId, organizationId: ctx.organizationId, propertyId: d.propertyId } });
    if (!u) return jsonError('Invalid unit for property', 400);
    unitTypeId = u.unitTypeId || null;
  }

  const nights = nightsBetween(d.arrivalDate, d.departureDate);
  if (nights < 1) return jsonError('Departure must be after arrival', 400);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(d.arrivalDate) < today) return jsonError('Arrival date cannot be in the past', 400);

  // Auto-calculate rate from rate plan if unitRate not explicitly provided
  let unitRate = d.unitRate || 0;
  if (!d.unitRate && d.ratePlanId) {
    const quote = await calculateRate({
      organizationId: ctx.organizationId,
      propertyId: d.propertyId,
      ratePlanId: d.ratePlanId,
      arrivalDate: d.arrivalDate,
      departureDate: d.departureDate,
      adults: d.adults,
      children: d.children,
      unitTypeId,
    });
    if (quote.restrictions.length > 0) {
      return jsonError(`Rate restrictions: ${quote.restrictions.join('; ')}`, 400);
    }
    unitRate = quote.unitRate;
  }

  // Require either an explicit rate or a rate plan that produces a non-zero rate
  if (!unitRate && !d.ratePlanId) {
    return jsonError('Either a unit rate or a rate plan is required', 400);
  }
  if (unitRate <= 0 && d.ratePlanId) {
    return jsonError('Rate plan produced a zero rate — please select a different plan or set a manual rate', 400);
  }

  const subtotal = nights * unitRate;
  const discountAmount = subtotal * Number(d.discount) / 100;
  const taxAmountCalc = (subtotal - discountAmount) * Number(d.taxAmount) / 100;
  const total = Math.max(0, subtotal - discountAmount + taxAmountCalc);

  // Availability check + create in a transaction to prevent double-booking race condition
  const booking = await prisma.$transaction(async (tx) => {
    if (d.unitId) {
      const conflict = await tx.booking.findFirst({
        where: {
          organizationId: ctx.organizationId, unitId: d.unitId, deletedAt: null,
          status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] },
          AND: [
            { arrivalDate: { lt: new Date(d.departureDate) } },
            { departureDate: { gt: new Date(d.arrivalDate) } },
          ],
        },
      });
      if (conflict) throw new Error('CONFLICT');
    }

    return tx.booking.create({
      data: {
        organizationId: ctx.organizationId,
        propertyId: d.propertyId,
        unitId: d.unitId || null,
        guestId: d.guestId,
        ratePlanId: d.ratePlanId || null,
        createdById: ctx.userId,
        confirmationCode: generateCode('B', 8),
        status: d.status,
        canceledAt: null,
        source: d.source,
        arrivalDate: new Date(d.arrivalDate),
        departureDate: new Date(d.departureDate),
        nights,
        adults: d.adults,
        children: d.children,
        infants: d.infants ?? 0,
        pets: 0,
        unitRate,
        totalAmount: total,
        taxAmount: taxAmountCalc,
        discount: discountAmount,
        paidAmount: 0,
        balance: total,
        currency: org?.currency || 'INR',
        specialRequests: d.specialRequests,
        internalNotes: d.internalNotes,
        guestIdType: d.guestIdType || guest.idType || null,
        guestIdNumber: d.guestIdNumber || guest.idNumber || null,
        idDocumentUrl: d.idDocumentUrl || guest.idDocumentUrl || null,
        idVerifiedAt: (d.guestIdType || guest.idType) ? new Date() : null,
        idVerifiedById: ctx.userId,
      },
    });
  }).catch((e) => {
    if (e.message === 'CONFLICT') return null;
    throw e;
  });
  if (!booking) return jsonError('Unit is not available for the selected dates', 409);

  // Unit only becomes occupied when explicitly checked in via /check-in endpoint

  // Auto-create pre-arrival housekeeping task if unit is assigned
  if (d.unitId) {
    try {
      const existingTask = await prisma.housekeepingTask.findFirst({
        where: { organizationId: ctx.organizationId, unitId: d.unitId, bookingId: booking.id, type: 'FULL_CLEAN', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      if (!existingTask) {
        await prisma.housekeepingTask.create({
          data: {
            organizationId: ctx.organizationId,
            propertyId: d.propertyId,
            unitId: d.unitId,
            bookingId: booking.id,
            type: 'FULL_CLEAN',
            priority: 6,
            scheduledFor: new Date(d.arrivalDate),
            notes: `Pre-arrival clean for ${booking.confirmationCode} — guest arrives ${d.arrivalDate}`,
            createdById: ctx.userId,
          },
        });
      }
    } catch (e) { console.error('Failed to create housekeeping task:', e); }
  }

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'BOOKING_CREATE', entity: 'Booking', entityId: booking.id, description: `Created booking ${booking.confirmationCode}` });

  try {
    const { notifyByRole } = await import('@/lib/notifications');
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      type: 'BOOKING_NEW',
      title: 'New booking',
      message: `${guest?.firstName} ${guest?.lastName} · ${nights} night${nights !== 1 ? 's' : ''} · ${booking.confirmationCode} · ${d.adults + d.children} guest${d.adults + d.children !== 1 ? 's' : ''}`,
      priority: 'NORMAL',
      entity: 'Booking',
      entityId: booking.id,
      actionUrl: `/dashboard/reservations/bookings/${booking.id}`,
      metadata: { confirmationCode: booking.confirmationCode, total, nights },
    });

  } catch (e) {
    console.error('notification error');
  }

  return jsonOk(booking, 201);
}
