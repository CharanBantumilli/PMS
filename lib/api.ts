import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type ApiContext = {
  organizationId: string;
  userId: string;
  role: string;
  isSuperAdmin: boolean;
};

export async function apiContext(): Promise<ApiContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const { prisma } = await import('./prisma');
  const organizationId = session.user.organizationId || '';
  // Reject stale sessions whose organization no longer exists (e.g. after a DB reset)
  if (!organizationId || !(await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) {
    return null;
  }
  return {
    organizationId,
    userId: session.user.id,
    role: session.user.role || 'STAFF',
    isSuperAdmin: !!session.user.isSuperAdmin,
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function hasRole(ctx: ApiContext, roles: string[]) {
  return ctx.isSuperAdmin || roles.includes(ctx.role);
}

export async function logActivity(opts: {
  organizationId: string;
  userId?: string | null;
  action: any;
  entity: string;
  entityId?: string;
  description: string;
  metadata?: any;
}) {
  const { prisma } = await import('./prisma');
  return prisma.activityLog.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      description: opts.description,
      metadata: opts.metadata,
    },
  });
}
