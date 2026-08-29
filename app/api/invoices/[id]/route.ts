import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
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
  const allowed: any = {};
  for (const k of ['status', 'notes', 'dueDate']) {
    if (k in body) allowed[k] = body[k];
  }
  if (allowed.dueDate) allowed.dueDate = new Date(allowed.dueDate);
  const existing = await prisma.invoice.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const invoice = await prisma.invoice.update({ where: { id: params.id }, data: allowed });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Invoice', entityId: invoice.id, description: `Updated invoice ${invoice.invoiceNumber}` });
  return jsonOk(invoice);
}
