import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { maintenanceSchema } from '@/lib/validators';
import { parsePagination, paginatedOk } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId };
  const [tickets, total] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where,
      include: { unit: { include: { property: true } }, assignee: true, booking: { include: { guest: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.maintenanceTicket.count({ where }),
  ]);
  return jsonOk(paginatedOk(tickets, total, pagination));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','HOUSEKEEPER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = maintenanceSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const unit = await prisma.unit.findFirst({ where: { id: parsed.data.unitId, organizationId: ctx.organizationId } });
  if (!unit) return jsonError('Invalid unit', 400);
  const t = await prisma.maintenanceTicket.create({
    data: {
      ...parsed.data,
      organizationId: ctx.organizationId,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      createdById: ctx.userId,
    } as any,
  });
  if (parsed.data.priority === 'URGENT') {
    await prisma.unit.update({ where: { id: unit.id }, data: { status: 'OUT_OF_ORDER' } }).catch(() => {});
  }
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'MaintenanceTicket', entityId: t.id, description: `Created maintenance ticket ${t.title}` });

  // Notify managers about the new ticket (urgent = high priority)
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    const property = await prisma.property.findUnique({ where: { id: unit.propertyId, organizationId: ctx.organizationId } });
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER'],
      type: parsed.data.priority === 'URGENT' ? 'MAINTENANCE_URGENT' : 'MAINTENANCE_NEW',
      title: parsed.data.priority === 'URGENT' ? 'Urgent maintenance ticket' : 'New maintenance ticket',
      message: `${parsed.data.title} · ${property?.name} · Unit #${unit.number} · Priority: ${parsed.data.priority}`,
      priority: parsed.data.priority === 'URGENT' ? 'URGENT' : parsed.data.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
      entity: 'MaintenanceTicket',
      entityId: t.id,
      actionUrl: `/dashboard/operations/maintenance`,
    });
  } catch (e) { console.error('Failed to send maintenance notification:', e); }

  return jsonOk(t, 201);
}
