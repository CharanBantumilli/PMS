import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk } from '@/lib/api';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const sessions = await prisma.userSession.findMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId }, orderBy: { lastActiveAt: 'desc' } });
  return jsonOk(sessions);
}

export async function DELETE() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  await prisma.userSession.deleteMany({ where: { userId: ctx.userId, organizationId: ctx.organizationId } });
  return jsonOk({ ok: true });
}
