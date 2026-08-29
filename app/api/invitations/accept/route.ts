import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk, logActivity } from '@/lib/api';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, name, password } = body;
  if (!token || !name || !password) return jsonError('Missing fields', 400);
  if (password.length < 8) return jsonError('Password must be at least 8 characters', 400);

  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return jsonError('Invitation is invalid or expired', 400);

  const existing = await prisma.user.findUnique({ where: { email: inv.email } });
  if (existing) return jsonError('A user with that email already exists', 409);

  const org = await prisma.organization.findUnique({ where: { id: inv.organizationId } });
  if (org) {
    const userCount = await prisma.user.count({ where: { organizationId: inv.organizationId } });
    if (userCount >= org.maxUsers) return jsonError(`Plan limit reached (${org.maxUsers} users).`, 402);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: inv.email, name, hashedPassword, role: inv.role, status: 'ACTIVE', organizationId: inv.organizationId,
    },
  });
  await prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  await logActivity({ organizationId: inv.organizationId, userId: user.id, action: 'INVITE', entity: 'User', entityId: user.id, description: `${user.email} joined via invitation` });
  return jsonOk({ ok: true, email: user.email });
}
