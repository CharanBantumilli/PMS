import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { guestSchema } from '@/lib/validators';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const guest = await prisma.guest.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { bookings: { include: { property: true, unit: true }, orderBy: { arrivalDate: 'desc' }, take: 50 } },
  });
  if (!guest) return jsonError('Not found', 404);
  return jsonOk(guest);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const existing = await prisma.guest.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const body = await req.json();
  const parsed = guestSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const guest = await prisma.guest.update({ where: { id: params.id }, data: parsed.data as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Guest', entityId: guest.id, description: `Updated guest ${guest.firstName} ${guest.lastName}` });
  return jsonOk(guest);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.guest.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.guest.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Guest', entityId: params.id, description: `Deleted guest ${existing.firstName} ${existing.lastName}` });
  return jsonOk({ ok: true });
}
