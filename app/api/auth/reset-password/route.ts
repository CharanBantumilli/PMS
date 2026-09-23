import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk, logActivity } from '@/lib/api';
import { hash } from 'bcryptjs';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
});

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const { token, password } = parsed.data;

  const record = await prisma.otpCode.findFirst({
    where: { code: token, purpose: 'PASSWORD_RESET', usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return jsonError('Invalid or expired reset token', 400);
  if (record.expiresAt < new Date()) return jsonError('Reset token has expired', 400);

  // Verify user exists and is active
  const user = await prisma.user.findUnique({ where: { email: record.email }, select: { id: true, status: true } });
  if (!user) return jsonError('User account not found', 400);
  if (user.status !== 'ACTIVE') return jsonError('User account is not active', 400);

  const hashedPassword = await hash(password, 12);

  // Invalidate all old PASSWORD_RESET tokens for this email + update password atomically
  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { email: record.email, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { email: record.email },
      data: { hashedPassword, tokenVersion: { increment: 1 } },
    }),
  ]);

  await logActivity({
    organizationId: null,
    userId: user.id,
    action: 'UPDATE',
    entity: 'User',
    entityId: user.id,
    description: 'Password reset via token',
  });

  return jsonOk({ ok: true, message: 'Password has been reset. You can now log in.' });
}
