import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { ratePlanSchema } from '@/lib/validators';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = ratePlanSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const existing = await prisma.ratePlan.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.ratePlan.findFirst({
      where: { organizationId: ctx.organizationId, name: parsed.data.name, id: { not: params.id } },
    });
    if (duplicate) return jsonError('A rate plan with this name already exists', 409);
  }
  const p = await prisma.ratePlan.update({ where: { id: params.id }, data: parsed.data as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'RatePlan', entityId: p.id, description: `Updated rate plan ${p.name}` });
  return jsonOk(p);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const existing = await prisma.ratePlan.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const bookingCount = await prisma.booking.count({
    where: { organizationId: ctx.organizationId, ratePlanId: params.id, deletedAt: null },
  });
  if (bookingCount > 0) return jsonError(`Cannot delete — ${bookingCount} booking(s) use this rate plan. Deactivate it instead.`, 409);
  await prisma.ratePlan.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'RatePlan', entityId: params.id, description: `Deleted rate plan ${existing.name}` });
  return jsonOk({ ok: true });
}
