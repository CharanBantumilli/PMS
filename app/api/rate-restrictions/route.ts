import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const schema = z.object({
  restrictionType: z.enum(['MIN_LOS','MAX_LOS','CLOSED_TO_ARRIVAL','CLOSED_TO_DEPARTURE','MIN_ADVANCE','MAX_ADVANCE']),
  startDate: z.string(),
  endDate: z.string(),
  propertyId: z.string().nullable().optional(),
  ratePlanId: z.string().nullable().optional(),
  minLOS: z.coerce.number().int().nullable().optional(),
  maxLOS: z.coerce.number().int().nullable().optional(),
  closedToArrival: z.boolean().default(false),
  closedToDeparture: z.boolean().default(false),
  minAdvance: z.coerce.number().int().nullable().optional(),
  maxAdvance: z.coerce.number().int().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const r = await prisma.rateRestriction.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { startDate: 'asc' } });
  return jsonOk(r);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;
  const r = await prisma.rateRestriction.create({
    data: {
      organizationId: ctx.organizationId,
      restrictionType: d.restrictionType, startDate: new Date(d.startDate), endDate: new Date(d.endDate),
      propertyId: d.propertyId, ratePlanId: d.ratePlanId,
      minLOS: d.minLOS, maxLOS: d.maxLOS,
      closedToArrival: d.closedToArrival, closedToDeparture: d.closedToDeparture,
      minAdvance: d.minAdvance, maxAdvance: d.maxAdvance, isActive: d.isActive,
    },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'RateRestriction', entityId: r.id, description: `Created rate restriction ${r.restrictionType}` });
  return jsonOk(r, 201);
}
