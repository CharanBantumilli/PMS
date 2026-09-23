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
  if (booking.status !== 'CHECKED_IN') {
    // Idempotent: already checked out
    if (booking.status === 'CHECKED_OUT') return jsonOk(booking);
    return jsonError(`Cannot check out from status ${booking.status}`, 400);
  }

  if (Number(booking.balance) > 0) {
    return jsonError(`Outstanding balance of ${booking.balance} must be paid before check-out.`, 402);
  }

  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_OUT', checkedOutAt: new Date() } });
  if (booking.unitId) {
    // Only transition to VACANT_DIRTY if the unit is currently in an OCCUPIED state
    const unit = await prisma.unit.findUnique({ where: { id: booking.unitId }, select: { status: true } });
    if (unit && (unit.status === 'OCCUPIED_CLEAN' || unit.status === 'OCCUPIED_DIRTY')) {
      await prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'VACANT_DIRTY' } });
    }
    // Auto-create a full clean housekeeping task
    try {
      const existingTask = await prisma.housekeepingTask.findFirst({
        where: { organizationId: ctx.organizationId, unitId: booking.unitId, type: 'FULL_CLEAN', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      if (!existingTask) {
        await prisma.housekeepingTask.create({
          data: {
            organizationId: ctx.organizationId,
            propertyId: booking.propertyId,
            unitId: booking.unitId,
            type: 'FULL_CLEAN',
            priority: 7,
            notes: `Full clean after check-out of ${booking.confirmationCode}`,
            createdById: ctx.userId,
          },
        });
      }
    } catch (e) {
      console.error('Failed to create housekeeping task:', e);
    }
  }
  await prisma.guest.update({
    where: { id: booking.guestId },
    data: { totalStays: { increment: 1 } } as any,
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CHECK_OUT', entity: 'Booking', entityId: booking.id, description: `Checked out ${booking.confirmationCode}` });

  // Notify managers and housekeeping about the checkout (unit needs cleaning)
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'],
      type: 'CHECK_OUT',
      title: 'Guest checked out',
      message: `${booking.guest.firstName} ${booking.guest.lastName} checked out of ${booking.unit ? `unit #${booking.unit.number}` : 'unit'}. Room marked dirty and cleaning task created.`,
      priority: 'NORMAL',
      entity: 'Booking',
      entityId: booking.id,
      actionUrl: `/dashboard/reservations/bookings/${booking.id}`,
    });
  } catch {}

  return jsonOk(updated);
}
