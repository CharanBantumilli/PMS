import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { guestBaseSchema } from '@/lib/validators';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const guest = await prisma.guest.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId, deletedAt: null },
    include: { bookings: { include: { property: true, unit: true }, orderBy: { arrivalDate: 'desc' }, take: 50 } },
  });
  if (!guest) return jsonError('Not found', 404);
  return jsonOk(guest);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const existing = await prisma.guest.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const body = await req.json();
  const parsed = guestBaseSchema.partial().safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  // Check for duplicate email/phone (excluding self)
  const orConditions: any[] = [];
  if (parsed.data.email) {
    orConditions.push({ email: { equals: parsed.data.email, mode: 'insensitive' } });
  }
  if (parsed.data.phone) {
    orConditions.push({ phone: parsed.data.phone });
  }
  if (orConditions.length > 0) {
    const duplicate = await prisma.guest.findFirst({
      where: { organizationId: ctx.organizationId, deletedAt: null, id: { not: params.id }, OR: orConditions },
      select: { id: true, firstName: true, lastName: true },
    });
    if (duplicate) {
      return jsonError(`Another guest with this ${parsed.data.email && parsed.data.phone ? 'email or phone' : parsed.data.email ? 'email' : 'phone'} already exists: ${duplicate.firstName} ${duplicate.lastName}`, 409);
    }
  }

  const guest = await prisma.guest.update({ where: { id: params.id }, data: parsed.data as any });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Guest', entityId: guest.id, description: `Updated guest ${guest.firstName} ${guest.lastName}` });
  return jsonOk(guest);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const existing = await prisma.guest.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!existing) return jsonError('Not found', 404);
  const activeBookingCount = await prisma.booking.count({
    where: { guestId: params.id, organizationId: ctx.organizationId, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }, deletedAt: null },
  });
  if (activeBookingCount > 0) return jsonError(`Cannot delete — ${activeBookingCount} active booking(s) exist for this guest. Cancel or check out first.`, 409);
  await prisma.guest.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'DELETE', entity: 'Guest', entityId: params.id, description: `Deleted guest ${existing.firstName} ${existing.lastName}` });
  return jsonOk({ ok: true });
}
