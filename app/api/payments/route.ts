import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { paymentSchema } from '@/lib/validators';
import { parsePagination, paginatedOk } from '@/lib/pagination';
import { daysFromNow } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId, deletedAt: null };
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: { include: { booking: { include: { guest: true } } } } },
      orderBy: { paidAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.payment.count({ where }),
  ]);
  return jsonOk(paginatedOk(payments, total, pagination));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST','ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;

  // Parallelize independent lookups (was 3 sequential queries, now 1 round-trip)
  const [booking, invoiceCheck, org] = await Promise.all([
    d.bookingId
      ? prisma.booking.findFirst({ where: { id: d.bookingId, organizationId: ctx.organizationId } })
      : null,
    d.invoiceId
      ? prisma.invoice.findFirst({ where: { id: d.invoiceId, organizationId: ctx.organizationId } })
      : null,
    prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } }),
  ]);

  if (d.bookingId && !booking) return jsonError('Invalid booking', 400);
  if (booking?.status === 'CANCELED') return jsonError('Cannot record payment for a canceled booking', 400);
  if (d.invoiceId && !invoiceCheck) return jsonError('Invalid invoice', 400);

  if (d.status === 'PAID') {
    if (d.bookingId && booking) {
      const tolerance = 0.01;
      if (Number(d.amount) > Number(booking.balance) + tolerance) {
        return jsonError(`Overpayment: amount ${d.amount} exceeds booking balance ${booking.balance}`, 400);
      }
    }
    if (d.invoiceId && invoiceCheck) {
      const tolerance = 0.01;
      if (Number(d.amount) > Number(invoiceCheck.balance) + tolerance) {
        return jsonError(`Overpayment: amount ${d.amount} exceeds invoice balance ${invoiceCheck.balance}`, 400);
      }
    }
  }

  const currency = org?.currency || 'INR';

  const payment = await prisma.payment.create({
    data: {
      organizationId: ctx.organizationId,
      invoiceId: d.invoiceId || null,
      bookingId: d.bookingId || null,
      amount: d.amount,
      currency,
      method: d.method,
      status: d.status,
      reference: d.reference,
      paidAt: d.status === 'PAID' ? (d.paidAt ? new Date(d.paidAt) : new Date()) : null,
      notes: d.notes,
    },
  });

  // Auto-create invoice if payment is for a booking without an invoice
  let invoiceId = d.invoiceId || null;
  if (d.bookingId && !invoiceId) {
    const existingInvoice = await prisma.invoice.findFirst({ where: { bookingId: d.bookingId, organizationId: ctx.organizationId, deletedAt: null } });
    if (!existingInvoice) {
      const maxInvoice = await prisma.invoice.findFirst({
        where: { organizationId: ctx.organizationId },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      let nextNum = 1;
      if (maxInvoice?.invoiceNumber) {
        const match = maxInvoice.invoiceNumber.match(/INV-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const invoiceNumber = `INV-${String(nextNum).padStart(5, '0')}`;
      const nights = booking!.nights || 1;
      const rate = Number(booking!.unitRate) || 0;
      const total = Number(booking!.totalAmount);
      const discount = Number(booking!.discount || 0);
      const taxAmount = Number(booking!.taxAmount) || 0;
      const subtotal = Math.round((total + discount - taxAmount) * 100) / 100;

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          bookingId: d.bookingId,
          invoiceNumber,
          status: 'SENT',
          issueDate: new Date(),
          dueDate: daysFromNow(14),
          subtotal, taxAmount, discount, total,
          paidAmount: d.status === 'PAID' ? Number(d.amount) : 0,
          balance: d.status === 'PAID' ? Math.max(0, total - Number(d.amount)) : total,
          currency,
          items: { create: [{ description: `Room — ${nights} night${nights > 1 ? 's' : ''}`, quantity: nights, unitPrice: rate, taxRate: 0, total: subtotal }] },
        },
      });
      invoiceId = invoice.id;
      await prisma.payment.update({ where: { id: payment.id }, data: { invoiceId: invoice.id } });
    } else {
      invoiceId = existingInvoice.id;
      await prisma.payment.update({ where: { id: payment.id }, data: { invoiceId: existingInvoice.id } });
    }
  }

  // Update balances — use raw SQL for atomicity where possible
  const updates: Promise<any>[] = [];

  if (d.bookingId && d.status === 'PAID' && (!invoiceId || !booking)) {
    await prisma.booking.update({ where: { id: d.bookingId }, data: { paidAmount: { increment: Number(d.amount) } } });
    await prisma.$executeRaw`UPDATE "Booking" SET "balance" = GREATEST(0, "totalAmount" - "paidAmount") WHERE "id" = ${d.bookingId}`;
    // Recalculate guest totalSpent
    if (booking?.guestId) {
      updates.push(
        prisma.payment.aggregate({ _sum: { amount: true }, where: { booking: { guestId: booking.guestId }, status: 'PAID', deletedAt: null, organizationId: booking.organizationId } })
          .then((sum) => prisma.guest.update({ where: { id: booking!.guestId! }, data: { totalSpent: Number(sum._sum.amount || 0) } } as any)),
      );
    }
  }

  if (invoiceId && d.status === 'PAID') {
    updates.push(
      prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount: { increment: Number(d.amount) } } }),
      prisma.$executeRaw`
        UPDATE "Invoice" SET
          "balance" = GREATEST(0, "total" - "paidAmount"),
          "status" = CASE
            WHEN GREATEST(0, "total" - "paidAmount") = 0 THEN 'PAID'::"InvoiceStatus"
            WHEN "paidAmount" > 0 THEN 'PARTIAL'::"InvoiceStatus"
            ELSE "status"
          END
        WHERE "id" = ${invoiceId}
      `,
    );

    // If invoice linked to a booking, update booking balance and guest totalSpent
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { bookingId: true } });
    if (inv?.bookingId) {
      const linkedBooking = booking?.id === inv.bookingId ? booking : await prisma.booking.findFirst({ where: { id: inv.bookingId, organizationId: ctx.organizationId } });
      // Increment paidAmount first, then recalculate balance (must be sequential, not parallel)
      await prisma.booking.update({ where: { id: inv.bookingId }, data: { paidAmount: { increment: Number(d.amount) } } });
      await prisma.$executeRaw`UPDATE "Booking" SET "balance" = GREATEST(0, "totalAmount" - "paidAmount") WHERE "id" = ${inv.bookingId}`;
      if (linkedBooking?.guestId) {
        updates.push(
          prisma.payment.aggregate({ _sum: { amount: true }, where: { booking: { guestId: linkedBooking.guestId }, status: 'PAID', deletedAt: null, organizationId: linkedBooking.organizationId } })
            .then((sum) => prisma.guest.update({ where: { id: linkedBooking!.guestId! }, data: { totalSpent: Number(sum._sum.amount || 0) } } as any)),
        );
      }
    }
  }

  if (updates.length > 0) await Promise.all(updates);

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'PAYMENT_RECEIVED', entity: 'Payment', entityId: payment.id, description: `Payment of ${d.amount} via ${d.method}` });

  // Notify managers and accountants about the payment
  if (d.status === 'PAID' && Number(d.amount) > 0) {
    try {
      const { notifyByRole } = await import('@/lib/notifications');
      const guest = booking?.guestId ? await prisma.guest.findFirst({ where: { id: booking.guestId, organizationId: ctx.organizationId } }) : null;
      await notifyByRole({
        organizationId: ctx.organizationId,
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
        type: 'PAYMENT_RECEIVED',
        title: 'Payment received',
        message: `${guest ? guest.firstName + ' ' + guest.lastName + ' · ' : ''}${currency} ${Number(d.amount).toLocaleString()} via ${d.method}`,
        priority: Number(d.amount) > 10000 ? 'HIGH' : 'NORMAL',
        entity: 'Payment',
        entityId: payment.id,
        actionUrl: booking ? `/dashboard/reservations/bookings/${booking.id}` : `/dashboard/finance/payments`,
        metadata: { amount: Number(d.amount), method: d.method },
      });
    } catch (e) { console.error('Failed to send payment notification:', e); }
  }

  return jsonOk(payment, 201);
}
