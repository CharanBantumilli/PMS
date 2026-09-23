import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { housekeepingTaskSchema } from '@/lib/validators';
import { parsePagination, paginatedOk } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId };
  const [tasks, total] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where,
      include: { unit: { include: { property: true } }, assignee: true, booking: { include: { guest: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { scheduledFor: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.housekeepingTask.count({ where }),
  ]);
  return jsonOk(paginatedOk(tasks, total, pagination));
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
      const property = await prisma.property.findUnique({ where: { id: parsed.data.propertyId, organizationId: ctx.organizationId } });
      await createNotification({
        organizationId: ctx.organizationId,
        userIds: [parsed.data.assigneeId],
        type: 'HOUSEKEEPING_ASSIGNED',
        title: 'New housekeeping task',
        message: `${parsed.data.type.replace('_', ' ')} · ${property?.name} · Unit #${unit.number} · Priority ${parsed.data.priority}/10`,
        priority: parsed.data.priority >= 8 ? 'HIGH' : 'NORMAL',
        entity: 'HousekeepingTask',
        entityId: t.id,
        actionUrl: `/dashboard/operations/housekeeping`,
      });
    } catch (e) { console.error('Failed to send housekeeping assignment notification:', e); }
  }

  return jsonOk(t, 201);
}
