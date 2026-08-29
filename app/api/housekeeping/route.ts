import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { housekeepingTaskSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const tasks = await prisma.housekeepingTask.findMany({
    where: { organizationId: ctx.organizationId },
    include: { unit: { include: { property: true } }, assignee: true },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { scheduledFor: 'asc' }],
    take: 200,
  });
  return jsonOk(tasks);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = housekeepingTaskSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const unit = await prisma.unit.findFirst({ where: { id: parsed.data.unitId, organizationId: ctx.organizationId } });
  if (!unit) return jsonError('Invalid unit', 400);
  const t = await prisma.housekeepingTask.create({
    data: {
      ...parsed.data,
      organizationId: ctx.organizationId,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      createdById: ctx.userId,
    } as any,
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'HousekeepingTask', entityId: t.id, description: `Created housekeeping task` });

  // If task is assigned to a specific user, notify them
  if (parsed.data.assigneeId) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      const property = await prisma.property.findUnique({ where: { id: parsed.data.propertyId } });
      await createNotification({
        organizationId: ctx.organizationId,
        userIds: [parsed.data.assigneeId],
        type: 'HOUSEKEEPING_ASSIGNED',
        title: 'New housekeeping task',
        message: `${parsed.data.type.replace('_', ' ')} · ${property?.name} · Unit #${unit.number} · Priority ${parsed.data.priority}/10`,
        priority: parsed.data.priority >= 8 ? 'HIGH' : 'NORMAL',
        entity: 'HousekeepingTask',
        entityId: t.id,
        actionUrl: `/dashboard/housekeeping`,
      });
    } catch {}
  }

  return jsonOk(t, 201);
}
