import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  markup: z.number().min(0).max(100).optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(['ACTIVE','PAUSED','ERROR','DISCONNECTED']).optional(),
  apiKey: z.string().nullable().optional(),
  apiSecret: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const c = await prisma.channel.findFirst({ where: { id: params.id, organizationId: ctx.organizationId }, include: { mappings: true, syncLogs: { take: 50, orderBy: { createdAt: 'desc' } } } });
  if (!c) return jsonError('Not found', 404);
  return jsonOk(c);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const existing = await prisma.channel.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const c = await prisma.channel.update({ where: { id: params.id }, data: parsed.data as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Channel', entityId: c.id, description: `Updated channel ${c.name}` });
  return jsonOk(c);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.channel.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.channel.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Channel', entityId: params.id, description: `Disconnected channel ${existing.name}` });
  return jsonOk({ ok: true });
}
