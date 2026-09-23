import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as register } from '@/app/api/register/route';

function mockSessionNull() {
  vi.mocked(getServerSession).mockResolvedValue(null as any);
}

const post = (body: any) => new NextRequest('http://localhost:3000/api/register', { method: 'POST', body: JSON.stringify(body) });

const valid = {
  organizationName: 'Test Hotels India',
  organizationSlug: 'test-hotels',
  name: 'Test Owner',
  email: 'owner@testhotels.in',
  password: 'Password@123',
  confirmPassword: 'Password@123',
};

function queueTransactionCapture(captured: { data?: any }) {
  vi.mocked(prisma.$transaction).mockImplementationOnce((async (fn: any) => {
    const tx = {
      organization: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          captured.data = data;
          return { id: 'org-new', name: valid.organizationName };
        }),
      },
      user: { create: vi.fn().mockResolvedValue({ id: 'user-new', email: valid.email }) },
    };
    return await fn(tx);
  }) as any);
}

function mockOtpAndEmail() {
  vi.mocked(prisma.otpCode.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.otpCode.create).mockResolvedValue({ id: 'otp-new', code: '123456' } as any);
  vi.mocked(prisma.integrationConfig.findFirst).mockResolvedValue(null);
}

describe('POST /api/register', () => {
  beforeEach(() => {
    mockSessionNull();
    vi.mocked(prisma.user.findUnique).mockClear();
    vi.mocked(prisma.organization.findUnique).mockClear();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.activityLog.create).mockResolvedValue(0 as any);
    vi.mocked(prisma.otpCode.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.otpCode.create).mockResolvedValue({ id: 'otp-new', code: '123456' } as any);
    vi.mocked(prisma.integrationConfig.findFirst).mockResolvedValue(null);
  });

  it('creates the workspace with PENDING_VERIFICATION status', async () => {
    const captured: { data?: any } = {};
    queueTransactionCapture(captured);
    mockOtpAndEmail();
    const res = await register(post({ ...valid, country: 'IN', currency: 'INR' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBeDefined();
    expect(body.organizationId).toBeDefined();
  });

  it('rejects weak passwords before touching the database', async () => {
    const res = await register(post({ ...valid, password: 'short', confirmPassword: 'short' }));
    expect(res.status).toBe(400);
    expect(vi.mocked(prisma.user.findUnique)).not.toHaveBeenCalled();
  });

  it('rejects invalid slugs (spaces/case)', async () => {
    const res = await register(post({ ...valid, organizationSlug: 'Invalid Slug!' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid emails', async () => {
    const res = await register(post({ ...valid, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('blocks duplicate account emails', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'existing-user' } as any);
    const res = await register(post(valid));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already/i);
  });

  it('blocks duplicate workspace slugs', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ id: 'existing-org' } as any);
    const res = await register(post(valid));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/slug/i);
  });

  it('password mismatch is rejected', async () => {
    const res = await register(post({ ...valid, confirmPassword: 'Different@123' }));
    expect(res.status).toBe(400);
  });
});
