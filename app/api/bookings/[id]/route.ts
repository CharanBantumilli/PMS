import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { nightsBetween } from '@/lib/utils';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { guest: true, unit: true, property: true, ratePlan: true, invoice: true, payments: true, extras: { include: { service: true } } },
  });
  if (!booking) return jsonError('Not found', 404);
  return jsonOk(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const existing = await prisma.booking.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);

  const body = await req.json();
  const allowed: any = {};
  for (const k of ['status','specialRequests','internalNotes','arrivalDate','departureDate','adults','children','source','unitId','ratePlanId']) {
    if (k in body) allowed[k] = body[k];
  }

  const arrival = allowed.arrivalDate ? new Date(allowed.arrivalDate) : existing.arrivalDate;
  const departure = allowed.departureDate ? new Date(allowed.departureDate) : existing.departureDate;
  if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) return jsonError('Invalid dates', 400);
  const datesChanged = 'arrivalDate' in allowed || 'departureDate' in allowed;
  let nights = existing.nights;
  if (datesChanged) {
    nights = nightsBetween(arrival, departure);
    if (nights < 1) return jsonError('Departure must be after arrival', 400);
    allowed.nights = nights;
  }

  if ('unitId' in allowed && allowed.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: allowed.unitId, organizationId: ctx.organizationId, propertyId: existing.propertyId } });
    if (!u) return jsonError('Invalid unit for property', 400);
  }

  // Availability check when the unit or the stay dates change
  if (('unitId' in allowed && allowed.unitId) || datesChanged) {
    const unitId = 'unitId' in allowed ? allowed.unitId : existing.unitId;
    if (unitId) {
      const conflict = await prisma.booking.findFirst({
        where: {
          organizationId: ctx.organizationId, unitId, id: { not: params.id },
          status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] },
          AND: [
            { arrivalDate: { lt: departure } },
            { departureDate: { gt: arrival } },
          ],
        },
      });
      if (conflict) return jsonError('Unit is not available for the selected dates', 409);
    }
  }

  if (datesChanged) {
    allowed.arrivalDate = arrival;
    allowed.departureDate = departure;
    const subtotal = nights * Number(existing.unitRate);
    const total = Math.max(0, subtotal - Number(existing.discount) + Number(existing.taxAmount));
    allowed.totalAmount = total;
    allowed.balance = Math.max(0, total - Number(existing.paidAmount));
  }

  if (allowed.status === 'CANCELED' && !existing.canceledAt) allowed.canceledAt = new Date();

  const updated = await prisma.booking.update({ where: { id: params.id }, data: allowed });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'BOOKING_UPDATE', entity: 'Booking', entityId: updated.id, description: `Updated booking ${updated.confirmationCode}` });
  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.booking.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.booking.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Booking', entityId: params.id, description: `Deleted booking ${existing.confirmationCode}` });
  return jsonOk({ ok: true });
}
