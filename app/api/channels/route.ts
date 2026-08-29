import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['BOOKING_COM','AIRBNB','EXPEDIA','AGODA','VRBO','HOTELS_COM','CUSTOM_ICAL','CUSTOM_API']),
  propertyId: z.string().nullable().optional(),
  markup: z.number().min(0).max(100).optional(),
  apiKey: z.string().nullable().optional(),
  apiSecret: z.string().nullable().optional(),
  syncUrl: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const channels = await prisma.channel.findMany({ where: { organizationId: ctx.organizationId }, include: { mappings: true, _count: { select: { mappings: true, syncLogs: true } } }, orderBy: { createdAt: 'desc' } });
  return jsonOk(channels);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const c = await prisma.channel.create({ data: { ...parsed.data, organizationId: ctx.organizationId } as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Channel', entityId: c.id, description: `Connected channel ${c.name}` });
  return jsonOk(c, 201);
}
