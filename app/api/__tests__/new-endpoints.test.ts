import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fnOrArr: any) => {
      if (Array.isArray(fnOrArr)) return Promise.all(fnOrArr);
      return fnOrArr;
    }),
    organization: { findUnique: vi.fn(), update: vi.fn() },
    otpCode: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

// Mock apiContext
vi.mock('@/lib/api', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...orig,
    apiContext: vi.fn(),
    hasRole: vi.fn(() => true),
    logActivity: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns ok when database is reachable', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
  });

  it('returns error when database is unreachable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const data = await res.json();
    expect(data.status).toBe('error');
    expect(data.database).toBe('disconnected');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('always returns success to prevent user enumeration', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.otpCode.create).mockResolvedValue({} as any);
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@test.com' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('returns success even for existing user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', email: 'test@test.com', organizationId: 'org-1' } as any);
    vi.mocked(prisma.otpCode.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.otpCode.create).mockResolvedValue({} as any);
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.otpCode.updateMany).toHaveBeenCalled();
    expect(prisma.otpCode.create).toHaveBeenCalled();
  });

  it('rejects missing email', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format (Zod)', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON body', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects missing token', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'newpassword123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects expired token', async () => {
    vi.mocked(prisma.otpCode.findFirst).mockResolvedValue({
      id: 'otp-1', email: 'test@test.com', code: 'abc', purpose: 'PASSWORD_RESET',
      expiresAt: new Date('2020-01-01'), usedAt: null,
    } as any);
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc', password: 'newpassword123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects short password (Zod)', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc', password: 'short' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects inactive user', async () => {
    vi.mocked(prisma.otpCode.findFirst).mockResolvedValue({
      id: 'otp-1', email: 'test@test.com', code: 'valid-token', purpose: 'PASSWORD_RESET',
      expiresAt: new Date('2099-01-01'), usedAt: null,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', status: 'INACTIVE' } as any);
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'newpassword123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('successfully resets password and invalidates old tokens', async () => {
    vi.mocked(prisma.otpCode.findFirst).mockResolvedValue({
      id: 'otp-1', email: 'test@test.com', code: 'valid-token', purpose: 'PASSWORD_RESET',
      expiresAt: new Date('2099-01-01'), usedAt: null,
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', status: 'ACTIVE' } as any);
    vi.mocked(prisma.otpCode.updateMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const req = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'newpassword123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.otpCode.updateMany).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });
});


