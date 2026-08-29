import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, jsonError, jsonOk, logActivity } from '@/lib/api';
import crypto from 'crypto';

function verifyTotp(secret: string, code: string): boolean {
  // Simple TOTP verification (RFC 6238, 30-second window)
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    const c = counter + i;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(c));
    const hmac = crypto.createHmac('sha1', Buffer.from(secret + '==', 'base64')).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const totp = String(binary % 1000000).padStart(6, '0');
    if (totp === code) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const body = await req.json();
  const code = String(body.code || '').trim();
  if (!code) return jsonError('Code is required', 400);

  const tfa = await prisma.twoFactorSecret.findUnique({ where: { userId: ctx.userId } });
  if (!tfa) return jsonError('2FA not set up', 400);

  if (!verifyTotp(tfa.secret, code)) return jsonError('Invalid code', 400);

  const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
  await prisma.twoFactorSecret.update({ where: { userId: ctx.userId }, data: { isEnabled: true, backupCodes } });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'TwoFactor', entityId: tfa.id, description: 'Enabled two-factor authentication' });
  return jsonOk({ ok: true, backupCodes });
}
