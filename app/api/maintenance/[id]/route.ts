import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),
  status: z.enum(['OPEN','ASSIGNED','IN_PROGRESS','AWAITING_PARTS','COMPLETED','CANCELED']).optional(),
  category: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  estimatedCost: z.number().nullable().optional(),
  actualCost: z.number().nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const existing = await prisma.maintenanceTicket.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const data: any = { ...parsed.data };
  if (parsed.data.scheduledFor) data.scheduledFor = new Date(parsed.data.scheduledFor);
  if (parsed.data.status === 'COMPLETED' && !existing.completedAt) data.completedAt = new Date();
  if (parsed.data.status === 'ASSIGNED' && !data.assigneeId && existing.assigneeId) data.assigneeId = existing.assigneeId;
  if (parsed.data.status === 'COMPLETED') {
    const activeStay = await prisma.booking.findFirst({
      where: { organizationId: ctx.organizationId, unitId: existing.unitId, status: 'CHECKED_IN' },
    });
    if (!activeStay) {
      await prisma.unit.update({ where: { id: existing.unitId }, data: { status: 'VACANT_CLEAN' } }).catch(() => {});
    }
  }
  const t = await prisma.maintenanceTicket.update({ where: { id: params.id }, data });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'MaintenanceTicket', entityId: t.id, description: `Updated ticket ${t.title}` });
  return jsonOk(t);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.maintenanceTicket.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.maintenanceTicket.delete({ where: { id: params.id } });
  return jsonOk({ ok: true });
}
