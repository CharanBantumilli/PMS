import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { nightsBetween } from '@/lib/utils';
import { calculateRate } from '@/lib/rate-engine';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELED', 'NO_SHOW']).optional(),
  specialRequests: z.string().max(2000).optional().nullable(),
  internalNotes: z.string().max(2000).optional().nullable(),
  arrivalDate: z.string().optional(),
  departureDate: z.string().optional(),
  adults: z.number().int().min(1).max(20).optional(),
  children: z.number().int().min(0).max(20).optional(),
  source: z.enum(['DIRECT','WALK_IN','PHONE','EMAIL','OTHER']).optional(),
  unitId: z.string().optional().nullable(),
  ratePlanId: z.string().optional().nullable(),
});

const VALID_BOOKING_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CHECKED_IN', 'CANCELED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELED'],
  CHECKED_IN: ['CHECKED_OUT', 'CANCELED'],
  CHECKED_OUT: [],
  CANCELED: [],
  NO_SHOW: [],
};

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null },
    include: { guest: true, unit: true, property: true, ratePlan: true, invoice: true, payments: true, extras: { include: { service: true } } },
  });
  if (!booking) return jsonError('Not found', 404);
  return jsonOk(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const existing = await prisma.booking.findFirst({ where: { id: params.id, organizationId: ctx.organizationId }, include: { unit: true } });
  if (!existing) return jsonError('Not found', 404);

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const allowed: any = {};
  for (const k of ['status','specialRequests','internalNotes','arrivalDate','departureDate','adults','children','source','unitId','ratePlanId']) {
    if (k in parsed.data && parsed.data[k as keyof typeof parsed.data] !== undefined) {
      allowed[k] = parsed.data[k as keyof typeof parsed.data];
    }
  }

  // Validate status transition
  if (allowed.status) {
    const validNext = VALID_BOOKING_TRANSITIONS[existing.status] || [];
    if (!validNext.includes(allowed.status)) {
      return jsonError(`Cannot transition from ${existing.status} to ${allowed.status}`, 400);
    }
    // Require full payment before confirming or checking in
    if (allowed.status === 'CONFIRMED' || allowed.status === 'CHECKED_IN') {
      const balance = Number(existing.balance);
      if (balance > 0) {
        return jsonError(`Cannot ${allowed.status === 'CONFIRMED' ? 'confirm' : 'check in'} — outstanding balance of ${existing.currency} ${balance.toFixed(2)} must be paid first`, 400);
      }
    }
  }

  const arrival = allowed.arrivalDate ? new Date(allowed.arrivalDate) : existing.arrivalDate;
  const departure = allowed.departureDate ? new Date(allowed.departureDate) : existing.departureDate;
  if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) return jsonError('Invalid dates', 400);
  const datesChanged = 'arrivalDate' in allowed || 'departureDate' in allowed;
  let nights = existing.nights;
  if (datesChanged) {
    nights = nightsBetween(arrival, departure);
    if (nights < 1) return jsonError('Departure must be after arrival', 400);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (arrival < today) return jsonError('Arrival date cannot be in the past', 400);
    allowed.nights = nights;
  }

  let unitTypeId: string | null = existing.unit?.unitTypeId || null;
  if ('unitId' in allowed && allowed.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: allowed.unitId, organizationId: ctx.organizationId, propertyId: existing.propertyId } });
    if (!u) return jsonError('Invalid unit for property', 400);
    unitTypeId = u.unitTypeId || null;
  }

  // Recalculate price when dates, rate plan, or guest counts change
  const ratePlanChanged = 'ratePlanId' in allowed && allowed.ratePlanId !== existing.ratePlanId;
  const guestsChanged = (allowed.adults !== undefined && allowed.adults !== existing.adults) ||
    (allowed.children !== undefined && allowed.children !== existing.children) ||
    (allowed.infants !== undefined && allowed.infants !== existing.infants);
  if (datesChanged || ratePlanChanged || guestsChanged) {
    let unitRate = Number(existing.unitRate);
    if (ratePlanChanged && allowed.ratePlanId) {
      const quote = await calculateRate({
        organizationId: ctx.organizationId,
        propertyId: existing.propertyId,
        ratePlanId: allowed.ratePlanId,
        arrivalDate: (allowed.arrivalDate || existing.arrivalDate.toISOString()).slice(0, 10),
        departureDate: (allowed.departureDate || existing.departureDate.toISOString()).slice(0, 10),
        adults: allowed.adults ?? existing.adults,
        children: allowed.children ?? existing.children,
        unitTypeId,
      });
      if (quote.restrictions.length > 0) {
        return jsonError(`Rate restrictions: ${quote.restrictions.join('; ')}`, 400);
      }
      unitRate = quote.unitRate;
      allowed.unitRate = unitRate;
    }
    const effectiveNights = datesChanged ? nights : existing.nights;
    const effectiveUnitRate = ratePlanChanged ? unitRate : Number(existing.unitRate);
    const newSubtotal = effectiveNights * effectiveUnitRate;
    const oldSubtotal = Number(existing.nights) * Number(existing.unitRate);
    const discountPct = oldSubtotal > 0 ? (Number(existing.discount) / oldSubtotal) * 100 : 0;
    const taxPct = oldSubtotal > 0 ? (Number(existing.taxAmount) / oldSubtotal) * 100 : 0;
    const newDiscount = Math.round(newSubtotal * discountPct) / 100;
    const newTax = Math.round((newSubtotal - newDiscount) * taxPct) / 100;
    const total = Math.max(0, newSubtotal - newDiscount + newTax);
    allowed.totalAmount = total;
    allowed.discount = newDiscount;
    allowed.taxAmount = newTax;
    allowed.balance = Math.max(0, total - Number(existing.paidAmount));
  }

  if (allowed.status === 'CANCELED' && !existing.canceledAt) allowed.canceledAt = new Date();

  // Wrap availability check, update, and unit status changes in a transaction
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction to prevent race conditions
      const fresh = await tx.booking.findFirst({
        where: { id: params.id, organizationId: ctx.organizationId },
        include: { unit: true },
      });
      if (!fresh) throw new Error('BOOKING_NOT_FOUND');

      // Availability check when the unit or the stay dates change
      if (('unitId' in allowed && allowed.unitId) || datesChanged) {
        const unitId = 'unitId' in allowed ? allowed.unitId : fresh.unitId;
        if (unitId) {
          const conflict = await tx.booking.findFirst({
            where: {
              organizationId: ctx.organizationId, unitId, id: { not: params.id }, deletedAt: null,
              status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] },
              AND: [
                { arrivalDate: { lt: departure } },
                { departureDate: { gt: arrival } },
              ],
            },
          });
          if (conflict) throw new Error('CONFLICT');
        }
      }

      // Perform the update
      const result = await tx.booking.update({ where: { id: params.id }, data: allowed });

      // Handle unit status changes on reassignment
      if ('unitId' in allowed) {
        const oldUnitId = fresh.unitId;
        const newUnitId = allowed.unitId;
        if (oldUnitId && oldUnitId !== newUnitId && ['CHECKED_IN', 'OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'].includes(fresh.status as string)) {
          await tx.unit.update({ where: { id: oldUnitId }, data: { status: 'VACANT_DIRTY' } }).catch(() => {});
        }
      }

      // Release unit if booking is canceled or checked out
      if ((allowed.status === 'CANCELED' || allowed.status === 'CHECKED_OUT') && fresh.unitId && ['CHECKED_IN', 'OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'].includes(fresh.status as string)) {
        await tx.unit.update({ where: { id: fresh.unitId }, data: { status: 'VACANT_DIRTY' } }).catch(() => {});
      }

      return result;
    });
  } catch (e: any) {
    if (e.message === 'CONFLICT') return jsonError('Unit is not available for the selected dates', 409);
    if (e.message === 'BOOKING_NOT_FOUND') return jsonError('Not found', 404);
    throw e;
  }
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'BOOKING_UPDATE', entity: 'Booking', entityId: updated.id, description: `Updated booking ${updated.confirmationCode}` });
  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.booking.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);

  // Cancel the booking and release the unit
  const updateData: any = { deletedAt: new Date() };
  if (existing.status !== 'CANCELED' && existing.status !== 'CHECKED_OUT') {
    updateData.status = 'CANCELED';
    updateData.canceledAt = existing.canceledAt || new Date();
  }

  await prisma.booking.update({ where: { id: params.id }, data: updateData });

  // Release unit if it was occupied by this booking
  if (existing.unitId && ['CHECKED_IN', 'OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'].includes(existing.status as string)) {
    await prisma.unit.update({ where: { id: existing.unitId }, data: { status: 'VACANT_DIRTY' } }).catch(() => {});
  }

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Booking', entityId: params.id, description: `Deleted booking ${existing.confirmationCode}` });
  return jsonOk({ ok: true });
}
