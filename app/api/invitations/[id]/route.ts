import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const inv = await prisma.invitation.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!inv) return jsonError('Not found', 404);
  await prisma.invitation.delete({ where: { id: params.id } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Invitation', entityId: params.id, description: `Revoked invitation for ${inv.email}` });
  return jsonOk({ ok: true });
}
