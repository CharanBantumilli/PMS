import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk } from '@/lib/api';

export async function PATCH(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const existing = await prisma.notification.findFirst({ where: { id: params.id, userId: ctx.userId, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const n = await prisma.notification.update({ where: { id: params.id }, data: { isRead: true, readAt: new Date() } });
  return jsonOk(n);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const existing = await prisma.notification.findFirst({ where: { id: params.id, userId: ctx.userId, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.notification.delete({ where: { id: params.id } });
  return jsonOk({ ok: true });
}
