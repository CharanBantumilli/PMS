import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!org) return jsonError('Not found', 404);
  return jsonOk({
    maxProperties: org.maxProperties,
    maxUsers: org.maxUsers,
    maxUnits: org.maxUnits,
    propertyCount: await prisma.property.count({ where: { organizationId: ctx.organizationId } }),
    userCount: await prisma.user.count({ where: { organizationId: ctx.organizationId } }),
    unitCount: await prisma.unit.count({ where: { organizationId: ctx.organizationId } }),
  });
}

const schema = z.object({
  maxProperties: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxUnits: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid input', 400);

  const data: any = {};
  if (parsed.data.maxProperties !== undefined) data.maxProperties = parsed.data.maxProperties;
  if (parsed.data.maxUsers !== undefined) data.maxUsers = parsed.data.maxUsers;
  if (parsed.data.maxUnits !== undefined) data.maxUnits = parsed.data.maxUnits;

  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data,
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Organization', entityId: org.id, description: 'Updated organization limits' });
  return jsonOk(org);
}
