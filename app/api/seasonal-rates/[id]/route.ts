import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  price: z.coerce.number().nonnegative().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid input', 400);
  const data: any = { ...parsed.data };
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate) data.endDate = new Date(data.endDate);
  const existing = await prisma.seasonalRate.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const r = await prisma.seasonalRate.update({ where: { id: params.id }, data });
  return jsonOk(r);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const existing = await prisma.seasonalRate.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.seasonalRate.delete({ where: { id: params.id } });
  return jsonOk({ ok: true });
}
