import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk } from '@/lib/api';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const existing = await prisma.userSession.findFirst({ where: { id: params.id, userId: ctx.userId, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.userSession.update({ where: { id: params.id }, data: { isActive: false } });
  return jsonOk({ ok: true });
}
