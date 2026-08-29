import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const PLAN_LIMITS: Record<string, { maxProperties: number; maxUsers: number; maxUnits: number; price: number }> = {
  STARTER: { maxProperties: 1, maxUsers: 5, maxUnits: 50, price: 29 },
  PROFESSIONAL: { maxProperties: 10, maxUsers: 25, maxUnits: 1000, price: 99 },
  ENTERPRISE: { maxProperties: 1000, maxUsers: 1000, maxUnits: 10000, price: 0 },
};

const schema = z.object({ plan: z.enum(['STARTER','PROFESSIONAL','ENTERPRISE']) });

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid plan', 400);
  const limits = PLAN_LIMITS[parsed.data.plan];
  if (!limits) return jsonError('Unknown plan', 400);
  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      plan: parsed.data.plan,
      planStatus: 'ACTIVE',
      ...limits,
    },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Organization', entityId: org.id, description: `Changed plan to ${parsed.data.plan}` });
  return jsonOk(org);
}
