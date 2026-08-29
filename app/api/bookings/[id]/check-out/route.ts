import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'])) return jsonError('Forbidden', 403);
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { guest: true, property: true, unit: true },
  });
  if (!booking) return jsonError('Not found', 404);
  if (booking.status !== 'CHECKED_IN') return jsonError(`Cannot check out from status ${booking.status}`, 400);

  if (Number(booking.balance) > 0) {
    return jsonError(`Outstanding balance of ${booking.balance} must be paid before check-out.`, 402);
  }

  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_OUT', checkedOutAt: new Date() } });
  if (booking.unitId) {
    await prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'VACANT_DIRTY' } });
    // Auto-create a full clean housekeeping task
    try {
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
    } catch {}
  }
  await prisma.guest.update({
    where: { id: booking.guestId },
    data: { totalStays: { increment: 1 }, totalSpent: { increment: Number(booking.totalAmount) } } as any,
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
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });
  } catch {}

  return jsonOk(updated);
}
