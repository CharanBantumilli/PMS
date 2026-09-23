import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { unitTypeSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const types = await prisma.unitTypeDefinition.findMany({
    where: { organizationId: ctx.organizationId },
    include: { _count: { select: { units: true } } },
    orderBy: { name: 'asc' },
  });
  return jsonOk(types);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = unitTypeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const t = await prisma.unitTypeDefinition.create({ data: { ...parsed.data, organizationId: ctx.organizationId } as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'UnitType', entityId: t.id, description: `Created unit type ${t.name}` });
  return jsonOk(t, 201);
}
