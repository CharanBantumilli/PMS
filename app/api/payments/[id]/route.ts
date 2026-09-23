import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const existing = await prisma.payment.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    if (existing.invoiceId && existing.status === 'PAID') {
      const inv = await tx.invoice.findFirst({ where: { id: existing.invoiceId, organizationId: ctx.organizationId } });
      if (inv) {
        const newPaid = Math.max(0, Number(inv.paidAmount) - Number(existing.amount));
        const balance = Math.max(0, Number(inv.total) - newPaid);
        const newStatus = balance === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : (inv.status === 'PAID' ? 'SENT' : inv.status);
        await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: newPaid, balance, status: newStatus as any } });

        if (inv.bookingId) {
          const linkedBooking = await tx.booking.findFirst({ where: { id: inv.bookingId, organizationId: ctx.organizationId } });
          if (linkedBooking) {
            const newBookingPaid = Math.max(0, Number(linkedBooking.paidAmount) - Number(existing.amount));
            await tx.booking.update({
              where: { id: inv.bookingId },
              data: { paidAmount: newBookingPaid },
            });
            await tx.$executeRaw`UPDATE "Booking" SET "balance" = GREATEST(0, "totalAmount" - "paidAmount") WHERE "id" = ${inv.bookingId}`;
            if (linkedBooking.guestId) {
              await tx.guest.update({ where: { id: linkedBooking.guestId }, data: { totalSpent: { decrement: Number(existing.amount) } } } as any);
            }
          }
        }
      }
    } else if (existing.bookingId && existing.status === 'PAID') {
      const booking = await tx.booking.findFirst({ where: { id: existing.bookingId, organizationId: ctx.organizationId } });
      if (booking) {
        const newPaid = Math.max(0, Number(booking.paidAmount) - Number(existing.amount));
        const balance = Math.max(0, Number(booking.totalAmount) - newPaid);
        await tx.booking.update({ where: { id: booking.id }, data: { paidAmount: newPaid, balance } });
        if (booking.guestId) {
          await tx.guest.update({ where: { id: booking.guestId }, data: { totalSpent: { decrement: Number(existing.amount) } } } as any);
        }
      }
    }
  });

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Payment', entityId: params.id, description: `Deleted payment ${existing.id}` });
  return jsonOk({ ok: true });
}
