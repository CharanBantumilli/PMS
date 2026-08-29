import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as getOrg, PATCH as updateOrg } from '@/app/api/organization/route';
import { POST as changePlan } from '@/app/api/organization/plan/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'owner@test.com', organizationId: orgId, organizationSlug: 'test',
      role, isSuperAdmin: false,
    },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}


describe('GET /api/organization', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('returns the organization', async () => {
    vi.mocked(prisma.organization.findUnique).mockReset();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1', name: 'Test', currency: 'INR' } as any);
    const res = await getOrg();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Test');
  });

  it('returns 404 when org not found', async () => {
    vi.mocked(prisma.organization.findUnique).mockReset();
    // First call (apiContext check) returns a valid org
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ id: 'org-1' } as any);
    // Second call (route handler) returns null
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);
    const res = await getOrg();
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/organization', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('updates organization details', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      id: 'org-1', currency: 'INR', name: 'Old',
    } as any);
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({
      id: 'org-1', name: 'New', currency: 'INR',
    } as any);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: any) => {
      return fn({ organization: { update: vi.fn().mockResolvedValue({ id: 'org-1', name: 'New' }) } });
    });

    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(200);
  });

  it('rejects non-INR currency', async () => {
    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ currency: 'USD' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/INR/i);
  });

  it('rejects EUR currency', async () => {
    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ currency: 'EUR' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(400);
  });

  it('accepts INR currency (locked)', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      id: 'org-1', currency: 'INR',
    } as any);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: any) => fn({ organization: { update: vi.fn() } }));
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({ id: 'org-1', currency: 'INR' } as any);

    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ currency: 'INR' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(200);
  });

  it('rejects MANAGER role', async () => {
    // prisma mocks reset individually below
    mockSession();
    mockSession('MANAGER');
    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(403);
  });

  it('rejects invalid email format', async () => {
    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const res = await updateOrg(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/organization/plan', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('changes plan to PROFESSIONAL', async () => {
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({
      id: 'org-1', plan: 'PROFESSIONAL', planStatus: 'ACTIVE',
    } as any);
    const req = new NextRequest('http://localhost:3000/api/organization/plan', {
      method: 'POST',
      body: JSON.stringify({ plan: 'PROFESSIONAL' }),
    });
    const res = await changePlan(req);
    expect(res.status).toBe(200);
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plan: 'PROFESSIONAL', maxProperties: 10, maxUnits: 1000 }),
    }));
  });

  it('rejects invalid plan', async () => {
    const req = new NextRequest('http://localhost:3000/api/organization/plan', {
      method: 'POST',
      body: JSON.stringify({ plan: 'ULTIMATE' }),
    });
    const res = await changePlan(req);
    expect(res.status).toBe(400);
  });

  it('rejects MANAGER role', async () => {
    // prisma mocks reset individually below
    mockSession();
    mockSession('MANAGER');
    const req = new NextRequest('http://localhost:3000/api/organization/plan', {
      method: 'POST',
      body: JSON.stringify({ plan: 'PROFESSIONAL' }),
    });
    const res = await changePlan(req);
    expect(res.status).toBe(403);
  });
});
