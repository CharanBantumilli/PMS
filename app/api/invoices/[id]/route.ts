import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID']).optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['PAID', 'PARTIAL', 'OVERDUE', 'VOID'],
  PARTIAL: ['PAID', 'OVERDUE', 'VOID'],
  PAID: [],
  OVERDUE: ['PAID', 'VOID'],
  VOID: [],
};

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null },
    include: { booking: { include: { guest: true, property: true } }, payments: { orderBy: { paidAt: 'desc' } }, items: true },
  });
  if (!invoice) return jsonError('Not found', 404);
  return jsonOk(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const existing = await prisma.invoice.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);

  const allowed: any = {};
  if (parsed.data.notes !== undefined) allowed.notes = parsed.data.notes;
  if (parsed.data.dueDate) allowed.dueDate = new Date(parsed.data.dueDate);

  // Validate status transition
  if (parsed.data.status) {
    const validNext = VALID_TRANSITIONS[existing.status] || [];
    if (!validNext.includes(parsed.data.status)) {
      return jsonError(`Cannot transition from ${existing.status} to ${parsed.data.status}`, 400);
    }
    // Cannot mark invoice PAID without sufficient payments
    if (parsed.data.status === 'PAID' && Number(existing.paidAmount) < Number(existing.total)) {
      return jsonError(`Cannot mark PAID: only ${existing.paidAmount} paid of ${existing.total} total`, 400);
    }
    allowed.status = parsed.data.status;
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (allowed.status === 'VOID') {
      const payments = await tx.payment.findMany({
        where: { invoiceId: params.id, deletedAt: null },
      });

      for (const p of payments) {
        if (p.status === 'PAID') {
          if (p.bookingId) {
            const booking = await tx.booking.findFirst({
              where: { id: p.bookingId, organizationId: ctx.organizationId },
            });
            if (booking) {
              const newPaid = Math.max(0, Number(booking.paidAmount) - Number(p.amount));
              const newBalance = Math.max(0, Number(booking.totalAmount) - newPaid);
              await tx.booking.update({
                where: { id: p.bookingId },
                data: { paidAmount: newPaid, balance: newBalance },
              });
            }
          }
        }
        await tx.payment.update({
          where: { id: p.id },
          data: { deletedAt: new Date() },
        });
      }

      allowed.paidAmount = 0;
      allowed.balance = Number(existing.total);
    }

    return tx.invoice.update({ where: { id: params.id }, data: allowed });
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Invoice', entityId: invoice.id, description: `Updated invoice ${invoice.invoiceNumber}` });
  return jsonOk(invoice);
}
