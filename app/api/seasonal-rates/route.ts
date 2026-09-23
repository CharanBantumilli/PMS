import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(80),
  ratePlanId: z.string(),
  propertyId: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  price: z.coerce.number().nonnegative(),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const rates = await prisma.seasonalRate.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { startDate: 'asc' } });
  return jsonOk(rates);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;
  if (new Date(d.endDate) <= new Date(d.startDate)) return jsonError('End date must be after start date', 400);
  const ratePlan = await prisma.ratePlan.findFirst({ where: { id: d.ratePlanId, organizationId: ctx.organizationId } });
  if (!ratePlan) return jsonError('Invalid rate plan', 400);
  if (d.propertyId) {
    const prop = await prisma.property.findFirst({ where: { id: d.propertyId, organizationId: ctx.organizationId } });
    if (!prop) return jsonError('Invalid property', 400);
  }
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } });
  const r = await prisma.seasonalRate.create({
    data: {
      organizationId: ctx.organizationId,
      name: d.name, ratePlanId: d.ratePlanId, propertyId: d.propertyId,
      startDate: new Date(d.startDate), endDate: new Date(d.endDate),
      price: d.price, currency: org?.currency || 'INR', priority: d.priority, isActive: d.isActive,
    },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'SeasonalRate', entityId: r.id, description: `Created seasonal rate ${r.name}` });
  return jsonOk(r, 201);
}
