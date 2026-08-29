import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['PENDING','IN_PROGRESS','COMPLETED','INSPECTED','FAILED']).optional(),
  assigneeId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const existing = await prisma.housekeepingTask.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);

  const update: any = { ...parsed.data };
  if (parsed.data.status === 'IN_PROGRESS' && !existing.startedAt) update.startedAt = new Date();
  if ((parsed.data.status === 'COMPLETED' || parsed.data.status === 'INSPECTED') && !existing.completedAt) update.completedAt = new Date();
  if (parsed.data.status === 'COMPLETED' && existing.startedAt) {
    update.duration = Math.round((Date.now() - existing.startedAt.getTime()) / 60000);
  }

  const t = await prisma.housekeepingTask.update({ where: { id: params.id }, data: update });
  if (parsed.data.status === 'COMPLETED') {
    const activeStay = await prisma.booking.findFirst({
      where: { organizationId: ctx.organizationId, unitId: t.unitId, status: 'CHECKED_IN' },
    });
    if (!activeStay) {
      await prisma.unit.update({ where: { id: t.unitId }, data: { status: 'VACANT_CLEAN' } }).catch(() => {});
    }
  }
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'HousekeepingTask', entityId: t.id, description: `Updated task status to ${t.status}` });
  return jsonOk(t);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const existing = await prisma.housekeepingTask.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  await prisma.housekeepingTask.delete({ where: { id: params.id } });
  return jsonOk({ ok: true });
}
