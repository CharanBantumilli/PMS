import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { unitSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('propertyId');
  const arrivalDate = searchParams.get('arrivalDate');
  const departureDate = searchParams.get('departureDate');

  const where: any = { organizationId: ctx.organizationId };
  if (propertyId) where.propertyId = propertyId;

  if (arrivalDate && departureDate) {
    where.status = { notIn: ['OUT_OF_ORDER', 'OUT_OF_SERVICE'] };
    where.isActive = true;
    where.id = {
      notIn: await prisma.booking.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          arrivalDate: { lt: new Date(departureDate) },
          departureDate: { gt: new Date(arrivalDate) },
          deletedAt: null,
        },
        select: { unitId: true },
      }).then((bks) => bks.map((b) => b.unitId).filter(Boolean)),
    };
  }

  const units = await prisma.unit.findMany({
    where,
    include: { property: true, unitType: true },
    orderBy: [{ property: { name: 'asc' } }, { number: 'asc' }],
  });
  return jsonOk(units);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = unitSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const property = await prisma.property.findFirst({ where: { id: parsed.data.propertyId, organizationId: ctx.organizationId } });
  if (!property) return jsonError('Invalid property', 400);

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  const count = await prisma.unit.count({ where: { organizationId: ctx.organizationId } });
  if (org && count >= org.maxUnits) return jsonError(`Plan limit reached (${org.maxUnits} units).`, 402);

  const unit = await prisma.unit.create({
    data: { ...parsed.data, organizationId: ctx.organizationId } as any,
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Unit', entityId: unit.id, description: `Created unit ${unit.number}` });
  return jsonOk(unit, 201);
}
