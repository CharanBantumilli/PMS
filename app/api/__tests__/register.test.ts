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
  password: 'password123',
};

/** Queue a $transaction stub whose tx.organization.create captures its data. */
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

describe('POST /api/register', () => {
  beforeEach(() => {
    mockSessionNull();
    // dup-check lookups accumulate across tests — isolate per test
    vi.mocked(prisma.user.findUnique).mockClear();
    vi.mocked(prisma.organization.findUnique).mockClear();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.activityLog.create).mockResolvedValue(0 as any);
  });

  it('creates the workspace with INR currency and IN defaults', async () => {
    const captured: { data?: any } = {};
    queueTransactionCapture(captured);
    const res = await register(post({ ...valid, country: 'IN' }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.activityLog.create)).toHaveBeenCalled();
    expect(captured.data?.currency).toBe('INR');
    expect(captured.data?.country).toBe('IN');
    const userCreate = (vi.mocked(prisma.$transaction).mock.calls[0][0] as any) && undefined;
    void userCreate;
  });

  it('rejects weak passwords before touching the database', async () => {
    const res = await register(post({ ...valid, password: 'short' }));
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
    expect((await res.json()).error).toMatch(/already exists/i);
  });

  it('blocks duplicate workspace slugs', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ id: 'existing-org' } as any);
    const res = await register(post(valid));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/workspace URL/i);
  });

  it('fake ISO countries are rejected', async () => {
    const res = await register(post({ ...valid, country: 'ZZ' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ISO country/i);
  });

  it('lowercase IN is normalized on save', async () => {
    const captured: { data?: any } = {};
    queueTransactionCapture(captured);
    const res = await register(post({ ...valid, country: 'in' }));
    expect(res.status).toBe(200);
    expect(captured.data?.country).toBe('IN');
  });

  it('non-INR currencies are rejected at registration (INR-only launch)', async () => {
    const res = await register(post({ ...valid, currency: 'USD' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/INR|Indian Rupee/i);
  });

  it('lowercase inr is accepted and normalized', async () => {
    const captured: { data?: any } = {};
    queueTransactionCapture(captured);
    const res = await register(post({ ...valid, currency: 'inr' }));
    expect(res.status).toBe(200);
    expect(captured.data?.currency).toBe('INR');
  });
});
