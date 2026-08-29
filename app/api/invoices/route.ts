import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';
import { generateCode, daysFromNow } from '@/lib/utils';

const createSchema = z.object({
  bookingId: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    taxRate: z.coerce.number().nonnegative().default(0),
  })).min(1),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { booking: { include: { guest: true } } },
    orderBy: { issueDate: 'desc' },
    take: 200,
  });
  return jsonOk(invoices);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;

  let booking = null;
  if (d.bookingId) {
    booking = await prisma.booking.findFirst({ where: { id: d.bookingId, organizationId: ctx.organizationId } });
    if (!booking) return jsonError('Invalid booking', 400);
  }
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });

  const items = d.items.map((it) => {
    const total = it.quantity * it.unitPrice;
    const tax = total * (it.taxRate / 100);
    return { ...it, total: total + tax };
  });
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const taxAmount = items.reduce((s, i) => s + (i.total - (i.quantity * i.unitPrice)), 0);
  const total = items.reduce((s, i) => s + i.total, 0);

  const count = await prisma.invoice.count({ where: { organizationId: ctx.organizationId } });
  const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: ctx.organizationId,
      bookingId: d.bookingId || null,
      invoiceNumber,
      status: 'DRAFT',
      issueDate: new Date(),
      dueDate: d.dueDate ? new Date(d.dueDate) : daysFromNow(14),
      subtotal, taxAmount, discount: 0, total,
      paidAmount: 0, balance: total, currency: org?.currency || 'INR',
      notes: d.notes,
      items: { create: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        total: i.total,
      })) },
    },
    include: { items: true },
  });

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'INVOICE_SENT', entity: 'Invoice', entityId: invoice.id, description: `Created invoice ${invoice.invoiceNumber}` });
  return jsonOk(invoice, 201);
}
