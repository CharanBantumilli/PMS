import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { expenseSchema } from '@/lib/validators';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','ACCOUNTANT','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = expenseSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const existing = await prisma.expense.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const e = await prisma.expense.update({ where: { id: params.id }, data: parsed.data as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Expense', entityId: e.id, description: `Updated expense ${e.description}` });
  return jsonOk(e);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','ACCOUNTANT'])) return jsonError('Forbidden', 403);
  const existing = await prisma.expense.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.expense.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Expense', entityId: params.id, description: `Deleted expense ${existing.description}` });
  return jsonOk({ ok: true });
}
