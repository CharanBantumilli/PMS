import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { guestSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const where: any = { organizationId: ctx.organizationId };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  const guests = await prisma.guest.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 200 });
  return jsonOk(guests);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const guest = await prisma.guest.create({ data: { ...parsed.data, organizationId: ctx.organizationId } as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Guest', entityId: guest.id, description: `Created guest ${guest.firstName} ${guest.lastName}` });

  // Notify managers and receptionists about the new guest
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'],
      type: 'GUEST_NEW',
      title: 'New guest added',
      message: `${guest.firstName} ${guest.lastName}${guest.email ? ' · ' + guest.email : ''}${guest.country ? ' · ' + guest.country : ''}`,
      priority: 'LOW',
      entity: 'Guest',
      entityId: guest.id,
      actionUrl: `/dashboard/guests/${guest.id}`,
    });
  } catch {}

  return jsonOk(guest, 201);
}
