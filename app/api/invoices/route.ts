import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';
import { generateCode, daysFromNow } from '@/lib/utils';
import { parsePagination, paginatedOk } from '@/lib/pagination';

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

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId, deletedAt: null };
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { booking: { include: { guest: true } } },
      orderBy: { issueDate: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.invoice.count({ where }),
  ]);
  return jsonOk(paginatedOk(invoices, total, pagination));
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
    booking = await prisma.booking.findFirst({ where: { id: d.bookingId, organizationId: ctx.organizationId }, include: { guest: true, property: true } });
    if (!booking) return jsonError('Invalid booking', 400);
  }
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true, state: true, gstin: true, sacCode: true, legalName: true } });

  const items = d.items.map((it) => {
    const total = Math.round(it.quantity * it.unitPrice * 100) / 100;
    const tax = Math.round(total * (it.taxRate / 100) * 100) / 100;
    return { ...it, total: Math.round((total + tax) * 100) / 100 };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 100) / 100;
  const taxAmount = Math.round(items.reduce((s, i) => s + (i.total - (i.quantity * i.unitPrice)), 0) * 100) / 100;
  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

  // GST calculation: CGST+SGST (intra-state) or IGST (inter-state)
  const avgTaxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 100 * 100) / 100 : 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  const guestState = booking?.guest?.state || null;
  const isIntraState = org?.state && guestState && org.state === guestState;
  if (isIntraState) {
    cgstAmount = Math.round(taxAmount / 2 * 100) / 100;
    sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
  } else {
    igstAmount = taxAmount;
  }

  // Use MAX() invoice number to prevent duplicates after deletions, with retry for collisions
  let invoiceNumber: string;
  let retries = 0;
  while (retries < 5) {
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
    invoiceNumber = `INV-${String(nextNum).padStart(5, '0')}`;
    try {
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          bookingId: d.bookingId || null,
          invoiceNumber,
          status: 'DRAFT',
          issueDate: new Date(),
          dueDate: d.dueDate ? new Date(d.dueDate) : daysFromNow(14),
          subtotal, taxAmount, cgstAmount, sgstAmount, igstAmount,
          gstRate: avgTaxRate,
          sacCode: org?.sacCode || '9961',
          discount: 0, total,
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
    } catch (e: any) {
      if (e?.code === 'P2002') {
        retries++;
        continue;
      }
      throw e;
    }
  }
  return jsonError('Failed to generate unique invoice number', 500);
}
