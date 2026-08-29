import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk, logActivity } from '@/lib/api';
import crypto from 'crypto';

export async function POST(_: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const secret = crypto.randomBytes(20).toString('base64').replace(/[+/=]/g, '').slice(0, 32);
  await prisma.twoFactorSecret.upsert({
    where: { userId: ctx.userId },
    update: { secret, isEnabled: false, backupCodes: [] },
    create: { organizationId: ctx.organizationId, userId: ctx.userId, secret, isEnabled: false, backupCodes: [] },
  });
  return jsonOk({ secret });
}
