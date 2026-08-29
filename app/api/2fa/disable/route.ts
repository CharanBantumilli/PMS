import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk, logActivity } from '@/lib/api';

export async function POST(_: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const tfa = await prisma.twoFactorSecret.findUnique({ where: { userId: ctx.userId } });
  if (!tfa) return jsonError('2FA not set up', 400);
  await prisma.twoFactorSecret.update({ where: { userId: ctx.userId }, data: { isEnabled: false } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'TwoFactor', entityId: tfa.id, description: 'Disabled two-factor authentication' });
  return jsonOk({ ok: true });
}
