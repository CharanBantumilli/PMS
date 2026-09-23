import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk } from '@/lib/api';

const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const VERIFY_RATE_LIMIT = { max: 3, windowMs: 600_000 };
const IP_RATE_LIMIT = { max: 10, windowMs: 600_000 };

function checkRateLimit(store: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const record = store.get(key);
  if (!record || record.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  record.count++;
  return record.count <= max;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, phone, code, purpose = 'LOGIN' } = body;

  if (!code) return jsonError('OTP code required', 400);
  if (!email && !phone) return jsonError('Email or phone required', 400);

  const ip = getClientIp(req);
  if (!checkRateLimit(ipAttempts, ip, IP_RATE_LIMIT.max, IP_RATE_LIMIT.windowMs)) {
    return jsonError('Too many verification attempts. Please try again later.', 429);
  }

  const rateLimitKey = email || phone || 'unknown';
  if (!checkRateLimit(verifyAttempts, rateLimitKey, VERIFY_RATE_LIMIT.max, VERIFY_RATE_LIMIT.windowMs)) {
    return jsonError('Too many verification attempts for this account. Please try again later.', 429);
  }

  const where: any = { code, purpose, usedAt: null };
  if (email) where.email = email;
  if (phone) where.phone = phone;

  const otp = await prisma.otpCode.findFirst({ where });

  if (!otp) return jsonError('Invalid OTP', 400);
  if (otp.expiresAt < new Date()) return jsonError('OTP expired. Please request a new one.', 400);

  if (purpose === 'REGISTER' && email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return jsonError('Account not found. Please register again.', 400);
    }
    if (user.status === 'ACTIVE') {
      return jsonError('Account is already active. Please log in.', 400);
    }
    if (user.status !== 'PENDING_VERIFICATION') {
      return jsonError('Account is not in a verifiable state.', 400);
    }

    await prisma.$transaction([
      prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
      prisma.otpCode.deleteMany({ where: { email, purpose, id: { not: otp.id } } }),
      prisma.user.update({
        where: { email },
        data: { status: 'ACTIVE', emailVerified: new Date() },
      }),
    ]);

    verifyAttempts.delete(rateLimitKey);

    return jsonOk({ ok: true, verified: true, activated: true });
  }

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
    prisma.otpCode.deleteMany({ where: { email: email || undefined, phone: phone || undefined, purpose, id: { not: otp.id } } }),
  ]);

  verifyAttempts.delete(rateLimitKey);

  return jsonOk({ ok: true, verified: true, activated: false });
}
