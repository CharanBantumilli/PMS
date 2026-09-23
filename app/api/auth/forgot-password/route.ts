import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk, logActivity } from '@/lib/api';
import crypto from 'crypto';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  // Always return success to prevent user enumeration
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return jsonOk({ ok: true, message: 'If an account exists, a reset link has been sent.' });

  // Invalidate any existing PASSWORD_RESET tokens for this email
  await prisma.otpCode.updateMany({
    where: { email: normalizedEmail, purpose: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  // Generate a reset token (64 bytes hex = 128 char token)
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.otpCode.create({
    data: {
      email: normalizedEmail,
      code: token,
      purpose: 'PASSWORD_RESET',
      expiresAt,
    },
  });

  await logActivity({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'CREATE',
    entity: 'OtpCode',
    entityId: user.id,
    description: 'Password reset requested',
  });

  // In production, send email with reset link: `${APP_URL}/reset-password?token=${token}`
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Password reset token for ${normalizedEmail}: ${token}`);
  }

  return jsonOk({ ok: true, message: 'If an account exists, a reset link has been sent.' });
}
