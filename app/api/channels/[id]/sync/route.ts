import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';
import { pushChannelAvailability, pullChannelReservations } from '@/lib/channels';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const channel = await prisma.channel.findFirst({ where: { id: params.id, organizationId: ctx.organizationId }, include: { mappings: { include: { } } } });
  if (!channel) return jsonError('Not found', 404);
  if (!channel.isEnabled) return jsonError('Channel is disabled', 400);
  if (!channel.syncUrl) return jsonError('No sync URL configured for this channel', 400);

  // Get all units in the channel's property (or all properties if none)
  const unitWhere: any = { organizationId: ctx.organizationId, isActive: true };
  if (channel.propertyId) unitWhere.propertyId = channel.propertyId;

  const allUnits = await prisma.unit.findMany({ where: unitWhere, select: { id: true, number: true, name: true } });

  // Filter to only units that have mappings for this channel
  const mappedUnitIds = new Set(channel.mappings.map((m) => m.unitId));
  const unitsToPush = mappedUnitIds.size > 0
    ? allUnits.filter((u) => mappedUnitIds.has(u.id))
    : allUnits;

  // Build unit payload with external IDs
  const units = unitsToPush.map((u) => {
    const mapping = channel.mappings.find((m) => m.unitId === u.id);
    return { unitId: u.id, externalId: mapping?.externalId || u.id, number: u.number, name: u.name, status: 'AVAILABLE' };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + 90); // Push 90 days of availability

  const result = await pushChannelAvailability({
    organizationId: ctx.organizationId,
    channelId: channel.id,
    channelName: channel.name,
    syncUrl: channel.syncUrl,
    channelType: channel.type,
    units,
    dateFrom: today,
    dateTo,
  });

  return jsonOk(result);
}
