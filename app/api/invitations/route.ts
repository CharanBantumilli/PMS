import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { inviteSchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const invites = await prisma.invitation.findMany({
    where: { organizationId: ctx.organizationId, acceptedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk(invites);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (exists) return jsonError('A user with that email already exists.', 409);

  // Don't allow stacking multiple active invitations for the same person
  const pending = await prisma.invitation.findFirst({
    where: { organizationId: ctx.organizationId, email: parsed.data.email.toLowerCase(), acceptedAt: null },
  });
  if (pending) return jsonError('An active invitation for that email already exists.', 409);

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  const userCount = await prisma.user.count({ where: { organizationId: ctx.organizationId } });
  if (org && userCount >= org.maxUsers) return jsonError(`Plan limit reached (${org.maxUsers} users).`, 402);

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const invite = await prisma.invitation.create({
    data: { ...parsed.data, email: parsed.data.email.toLowerCase(), organizationId: ctx.organizationId, token, expiresAt, senderId: ctx.userId, permissions: parsed.data.permissions ?? null },
  });
  const base = process.env.APP_URL || 'http://localhost:3000';
  const acceptUrl = `${base}/invite/${token}`;

  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'INVITE', entity: 'Invitation', entityId: invite.id, description: `Invited ${invite.email} as ${invite.role}` });

  // Notify existing admins that a new invite was sent
  try {
    const { notifyByRole } = await import('@/lib/notifications');
    await notifyByRole({
      organizationId: ctx.organizationId,
      roles: ['OWNER', 'ADMIN'],
      type: 'STAFF_INVITED',
      title: 'Staff invitation sent',
      message: `Invitation to ${invite.email} as ${invite.role} has been sent. Expires in 7 days.`,
      priority: 'LOW',
      entity: 'Invitation',
      entityId: invite.id,
      actionUrl: `/dashboard/staff`,
    });
  } catch (e) { console.error('Failed to send invitation notification:', e); }

  return jsonOk({ ...invite, acceptUrl }, 201);
}
