import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const existing = await prisma.payment.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.payment.delete({ where: { id: params.id } });

  // Reverse booking balance
  if (existing.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: existing.bookingId } });
    if (booking) {
      const newPaid = Math.max(0, Number(booking.paidAmount) - Number(existing.amount));
      const balance = Math.max(0, Number(booking.totalAmount) - newPaid);
      await prisma.booking.update({ where: { id: booking.id }, data: { paidAmount: newPaid, balance } });
    }
  }
  return jsonOk({ ok: true });
}
