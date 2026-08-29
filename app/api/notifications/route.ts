import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk } from '@/lib/api';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  const where: any = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
  if (unreadOnly) where.isRead = false;
  if (type) where.type = type;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);
  return jsonOk({ notifications, unreadCount });
}
