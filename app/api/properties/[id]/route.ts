import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { propertySchema } from '@/lib/validators';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const property = await prisma.property.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { units: { include: { unitType: true } } },
  });
  if (!property) return jsonError('Not found', 404);
  return jsonOk(property);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = propertySchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const existing = await prisma.property.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);

  const property = await prisma.property.update({ where: { id: params.id }, data: parsed.data });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Property', entityId: property.id, description: `Updated property ${property.name}` });
  return jsonOk(property);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.property.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.property.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Property', entityId: params.id, description: `Deleted property ${existing.name}` });
  return jsonOk({ ok: true });
}
