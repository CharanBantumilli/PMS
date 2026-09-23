import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { guest: true, property: true, unit: true },
  });
  if (!booking) return jsonError('Not found', 404);
  if (!['PENDING','CONFIRMED'].includes(booking.status)) {
    // Idempotent: already checked in
    if (booking.status === 'CHECKED_IN') return jsonOk(booking);
    return jsonError(`Cannot check in from status ${booking.status}`, 400);
  }

  // Require full payment before check-in
  const balance = Number(booking.balance);
  if (balance > 0) {
    return jsonError(`Cannot check in — outstanding balance of ${booking.currency} ${balance.toFixed(2)} must be paid first`, 400);
  }

  // Verify unit is still available and check in atomically
  if (booking.unitId) {
    const result = await prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          organizationId: ctx.organizationId,
          unitId: booking.unitId,
          id: { not: booking.id },
          deletedAt: null,
          status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] },
          AND: [
            { arrivalDate: { lt: booking.departureDate } },
            { departureDate: { gt: booking.arrivalDate } },
          ],
        },
      });
      if (conflict) return null;

      const updated = await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN', checkedInAt: new Date() } });
      await tx.unit.update({ where: { id: booking.unitId! }, data: { status: 'OCCUPIED_CLEAN' } });
      return updated;
    });
    if (!result) return jsonError('Unit is no longer available — it has been booked by another reservation', 409);
  } else {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN', checkedInAt: new Date() } });
  }

  // Auto-generate a housekeeping task for the room after check-in
  if (booking.unitId) {
    try {
      const existingTask = await prisma.housekeepingTask.findFirst({
        where: { organizationId: ctx.organizationId, unitId: booking.unitId, bookingId: booking.id, type: 'TURNDOWN', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      if (!existingTask) {
        await prisma.housekeepingTask.create({
          data: {
            organizationId: ctx.organizationId,
            propertyId: booking.propertyId,
            unitId: booking.unitId,
            bookingId: booking.id,
            type: 'TURNDOWN',
            priority: 5,
            notes: `Post check-in turndown service for ${booking.confirmationCode}`,
            createdById: ctx.userId,
          },
        });
      }
    } catch (e) {
      console.error('Failed to create housekeeping task:', e);
    }
  }

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CHECK_IN', entity: 'Booking', entityId: booking.id, description: `Checked in ${booking.confirmationCode}` });

  // Notify managers and housekeeping
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'],
      type: 'CHECK_IN',
      title: 'Guest checked in',
      message: `${booking.guest.firstName} ${booking.guest.lastName} checked in to ${booking.unit ? `#${booking.unit.number}` : 'unassigned unit'} at ${booking.property.name}`,
      priority: 'NORMAL',
      entity: 'Booking',
      entityId: booking.id,
      actionUrl: `/dashboard/reservations/bookings/${booking.id}`,
    });
  } catch {}

  return jsonOk({ ...booking, status: 'CHECKED_IN', checkedInAt: new Date() });
}
