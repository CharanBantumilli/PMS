import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk } from '@/lib/api';

export async function POST(_: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const result = await prisma.notification.updateMany({
    where: { organizationId: ctx.organizationId, userId: ctx.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return jsonOk({ ok: true, count: result.count });
}
