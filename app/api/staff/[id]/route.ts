import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { z } from 'zod';

const VALID_SECTIONS = [
  'dashboard','notifications','properties','units','bookings','guests','rate-plans',
  'rates','calendar','housekeeping','maintenance','invoices','payments',
  'expenses','guests-staff','reports','integrations','security','settings',
];

const patchSchema = z.object({
  role: z.enum(['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER','ACCOUNTANT']).optional(),
  status: z.enum(['ACTIVE','INVITED','SUSPENDED']).optional(),
  name: z.string().min(1).optional(),
  permissions: z.array(z.string()).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const u = await prisma.user.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!u) return jsonError('Not found', 404);
  if (parsed.data.role && u.id === ctx.userId) return jsonError('You cannot change your own role.', 400);
  if (parsed.data.role === 'OWNER' && ctx.role !== 'OWNER') return jsonError('Only the owner can assign the owner role.', 403);
  if (u.role === 'OWNER' && parsed.data.role !== 'OWNER' && ctx.role !== 'OWNER') return jsonError('Only the owner can change an owner.', 403);
  // Validate permissions if provided
  if (parsed.data.permissions !== undefined && parsed.data.permissions !== null) {
    const invalid = parsed.data.permissions.filter((s) => !VALID_SECTIONS.includes(s));
    if (invalid.length > 0) return jsonError(`Invalid sections: ${invalid.join(', ')}`, 400);
  }
  const updateData: Record<string, any> = {};
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions;
  const updated = await prisma.user.update({ where: { id: params.id }, data: updateData });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'User', entityId: u.id, description: `Updated user ${u.email}` });
  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const u = await prisma.user.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!u) return jsonError('Not found', 404);
  if (u.id === ctx.userId) return jsonError('Cannot remove yourself.', 400);
  await prisma.user.update({ where: { id: params.id }, data: { organizationId: null, role: 'MANAGER' } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'User', entityId: u.id, description: `Removed user ${u.email} from workspace` });
  return jsonOk({ ok: true });
}
