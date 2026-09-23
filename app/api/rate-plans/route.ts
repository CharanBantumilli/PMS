import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { ratePlanSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const plans = await prisma.ratePlan.findMany({ where: { organizationId: ctx.organizationId }, include: { property: true }, orderBy: { createdAt: 'desc' } });
  return jsonOk(plans);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = ratePlanSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  if (parsed.data.propertyId) {
    const prop = await prisma.property.findFirst({ where: { id: parsed.data.propertyId, organizationId: ctx.organizationId } });
    if (!prop) return jsonError('Invalid property', 400);
  }
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });
  const p = await prisma.ratePlan.create({ data: { ...parsed.data, currency: org?.currency || 'INR', organizationId: ctx.organizationId } as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'RatePlan', entityId: p.id, description: `Created rate plan ${p.name}` });
  return jsonOk(p, 201);
}
