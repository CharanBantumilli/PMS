import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { expenseSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const expenses = await prisma.expense.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { expenseDate: 'desc' }, take: 200 });
  return jsonOk(expenses);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','ACCOUNTANT','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });
  const e = await prisma.expense.create({ data: { ...parsed.data, currency: org?.currency || 'INR', organizationId: ctx.organizationId } as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Expense', entityId: e.id, description: `Created expense ${e.description}` });
  return jsonOk(e, 201);
}
