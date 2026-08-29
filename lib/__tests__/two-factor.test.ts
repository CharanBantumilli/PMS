import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// TOTP verification (copy of logic from route)
function verifyTotp(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    const c = counter + i;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(c));
    const paddedSecret = secret + '='.repeat((8 - secret.length % 8) % 8);
    const hmac = crypto.createHmac('sha1', Buffer.from(paddedSecret, 'base64')).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const totp = String(binary % 1000000).padStart(6, '0');
    if (totp === code) return true;
  }
  return false;
}

function generateTotp(secret: string, counter?: number): string {
  const c = counter ?? Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(c));
  const paddedSecret = secret + '='.repeat((8 - secret.length % 8) % 8);
  const hmac = crypto.createHmac('sha1', Buffer.from(paddedSecret, 'base64')).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

describe('TOTP implementation', () => {
  const secret = 'JBSWY3DPEHPK3PXP'; // standard test secret

  it('generates a 6-digit code', () => {
    const code = generateTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies a valid current code', () => {
    const code = generateTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('rejects an invalid code', () => {
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('accepts codes from ±1 time window (±30 seconds)', () => {
    const counter = Math.floor(Date.now() / 1000 / 30);
    const pastCode = generateTotp(secret, counter - 1);
    const futureCode = generateTotp(secret, counter + 1);
    expect(verifyTotp(secret, pastCode)).toBe(true);
    expect(verifyTotp(secret, futureCode)).toBe(true);
  });

  it('rejects codes from outside the time window', () => {
    const counter = Math.floor(Date.now() / 1000 / 30);
    const oldCode = generateTotp(secret, counter - 5);
    expect(verifyTotp(secret, oldCode)).toBe(false);
  });

  it('rejects codes with wrong secret', () => {
    const code = generateTotp(secret);
    expect(verifyTotp('DIFFERENTSECRETKEY', code)).toBe(false);
  });

  it('rejects non-numeric codes', () => {
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
  });

  it('rejects empty codes', () => {
    expect(verifyTotp(secret, '')).toBe(false);
  });
});

describe('POST /api/2fa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'user-1', email: 'test@test.com', organizationId: 'org-1', organizationSlug: 'test',
        role: 'OWNER', isSuperAdmin: false,
      },
      expires: '2099-01-01',
    } as any);
  });

  it('generates a secret for the user', async () => {
    const { POST } = await import('@/app/api/2fa/setup/route');
    const req = new NextRequest('http://localhost:3000/api/2fa/setup', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secret).toBeDefined();
    expect(body.secret.length).toBeGreaterThan(10);
  });

  it('upserts the secret in the database', async () => {
    const { POST } = await import('@/app/api/2fa/setup/route');
    const req = new NextRequest('http://localhost:3000/api/2fa/setup', { method: 'POST' });
    await POST(req);
    expect(prisma.twoFactorSecret.upsert).toHaveBeenCalled();
  });
});
