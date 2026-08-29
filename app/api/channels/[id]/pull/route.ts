import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';
import { pullChannelReservations } from '@/lib/channels';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const channel = await prisma.channel.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!channel) return jsonError('Not found', 404);
  if (!channel.syncUrl) return jsonError('No sync URL configured', 400);

  const since = channel.lastSyncAt || new Date(Date.now() - 7 * 24 * 3600 * 1000); // Last 7 days
  const result = await pullChannelReservations({
    organizationId: ctx.organizationId,
    channelId: channel.id,
    syncUrl: channel.syncUrl,
    channelType: channel.type,
    since,
  });

  return jsonOk(result);
}
