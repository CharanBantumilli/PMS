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
  if (!['PENDING','CONFIRMED'].includes(booking.status)) return jsonError(`Cannot check in from status ${booking.status}`, 400);
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN', checkedInAt: new Date() } });
  if (booking.unitId) await prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'OCCUPIED_CLEAN' } });

  // Auto-generate a housekeeping task for the room after checkout-prep
  try {
    if (booking.unitId) {
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
  } catch {}

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
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });
  } catch {}

  return jsonOk(updated);
}
