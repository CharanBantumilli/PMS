import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({ name: z.string().optional(), isActive: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid input', 400);
  const existing = await prisma.apiKey.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const k = await prisma.apiKey.update({ where: { id: params.id }, data: parsed.data });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'ApiKey', entityId: k.id, description: `Updated API key ${k.name}` });
  return jsonOk(k);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.apiKey.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.apiKey.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'ApiKey', entityId: params.id, description: `Revoked API key ${existing.name}` });
  return jsonOk({ ok: true });
}
