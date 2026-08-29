import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { paymentSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const payments = await prisma.payment.findMany({
    where: { organizationId: ctx.organizationId },
    include: { invoice: { include: { booking: { include: { guest: true } } } } },
    orderBy: { paidAt: 'desc' },
    take: 200,
  });
  return jsonOk(payments);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST','ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;

  let booking = null;
  if (d.bookingId) {
    booking = await prisma.booking.findFirst({ where: { id: d.bookingId, organizationId: ctx.organizationId } });
    if (!booking) return jsonError('Invalid booking', 400);
  }
  if (d.invoiceId) {
    const inv = await prisma.invoice.findFirst({ where: { id: d.invoiceId, organizationId: ctx.organizationId } });
    if (!inv) return jsonError('Invalid invoice', 400);
  }
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });

  const payment = await prisma.payment.create({
    data: {
      organizationId: ctx.organizationId,
      invoiceId: d.invoiceId || null,
      bookingId: d.bookingId || null,
      amount: d.amount,
      currency: org?.currency || 'INR',
      method: d.method,
      status: d.status,
      reference: d.reference,
      paidAt: d.status === 'PAID' ? (d.paidAt ? new Date(d.paidAt) : new Date()) : null,
      notes: d.notes,
    },
  });

  // Update booking paid amount and balance
  if (booking && d.status === 'PAID') {
    const newPaid = Number(booking.paidAmount) + Number(d.amount);
    const balance = Math.max(0, Number(booking.totalAmount) - newPaid);
    await prisma.booking.update({ where: { id: booking.id }, data: { paidAmount: newPaid, balance } });
  }
  if (d.invoiceId && d.status === 'PAID') {
    const inv = await prisma.invoice.findUnique({ where: { id: d.invoiceId } });
    if (inv) {
      const newPaid = Number(inv.paidAmount) + Number(d.amount);
      const balance = Math.max(0, Number(inv.total) - newPaid);
      const newStatus = balance === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : inv.status;
      await prisma.invoice.update({ where: { id: inv.id }, data: { paidAmount: newPaid, balance, status: newStatus as any } });
    }
  }

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'PAYMENT_RECEIVED', entity: 'Payment', entityId: payment.id, description: `Payment of ${d.amount} via ${d.method}` });

  // Notify managers and accountants about the payment
  if (d.status === 'PAID' && Number(d.amount) > 0) {
    try {
      const { notifyByRole } = await import('@/lib/notifications');
      const guest = booking ? await prisma.guest.findUnique({ where: { id: booking.guestId } }) : null;
      await notifyByRole({
        organizationId: ctx.organizationId,
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
        type: 'PAYMENT_RECEIVED',
        title: 'Payment received',
        message: `${guest ? guest.firstName + ' ' + guest.lastName + ' · ' : ''}₹${Number(d.amount).toLocaleString('en-IN')} via ${d.method}`,
        priority: Number(d.amount) > 10000 ? 'HIGH' : 'NORMAL',
        entity: 'Payment',
        entityId: payment.id,
        actionUrl: booking ? `/dashboard/bookings/${booking.id}` : `/dashboard/payments`,
        metadata: { amount: Number(d.amount), method: d.method },
      });
    } catch {}
  }

  return jsonOk(payment, 201);
}
