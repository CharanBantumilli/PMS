import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { guestSchema } from '@/lib/validators';
import { parsePagination, paginatedOk } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const pagination = parsePagination(req);
  const where: any = { organizationId: ctx.organizationId, deletedAt: null };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [guests, total] = await Promise.all([
    prisma.guest.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: pagination.skip, take: pagination.take }),
    prisma.guest.count({ where }),
  ]);
  return jsonOk(paginatedOk(guests, total, pagination));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  // Check for duplicate by email or phone
  const orConditions: any[] = [];
  if (parsed.data.email) {
    orConditions.push({ email: { equals: parsed.data.email, mode: 'insensitive' } });
  }
  if (parsed.data.phone) {
    orConditions.push({ phone: parsed.data.phone });
  }
  if (orConditions.length > 0) {
    const existing = await prisma.guest.findFirst({
      where: { organizationId: ctx.organizationId, deletedAt: null, OR: orConditions },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    if (existing) {
      return jsonError(`A guest with this ${parsed.data.email && parsed.data.phone ? 'email or phone' : parsed.data.email ? 'email' : 'phone'} already exists: ${existing.firstName} ${existing.lastName}`, 409);
    }
  }

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
      actionUrl: `/dashboard/reservations/guests/${guest.id}`,
    });
  } catch (e) { console.error('Failed to send guest notification:', e); }

  return jsonOk(guest, 201);
}
