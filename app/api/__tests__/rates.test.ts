import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as createSeasonalRate } from '@/app/api/seasonal-rates/route';
import { POST as createRestriction } from '@/app/api/rate-restrictions/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: 'user-1', email: 't@t.com', organizationId: orgId, organizationSlug: 'test', role, isSuperAdmin: false },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId, currency: 'INR' } as any);
}

const post = (path: string, body: any) => new NextRequest(`http://localhost:3000${path}`, { method: 'POST', body: JSON.stringify(body) });

const validRate = {
  name: 'Diwali Peak',
  ratePlanId: 'plan-1',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  price: 7500,
};

describe('POST /api/seasonal-rates', () => {
  beforeEach(() => mockSession());

  it('creates a seasonal rate priced in the workspace currency (INR)', async () => {
    vi.mocked(prisma.ratePlan.findFirst).mockResolvedValue({ id: 'plan-1', organizationId: 'org-1' } as any);
    vi.mocked(prisma.seasonalRate.create).mockResolvedValueOnce({ id: 'sr1', currency: 'INR', ...validRate } as any);
    const res = await createSeasonalRate(post('/api/seasonal-rates', validRate));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.currency).toBe('INR');
  });

  it('rejects rate plans belonging to another organization (tenant isolation)', async () => {
    vi.mocked(prisma.ratePlan.findFirst).mockResolvedValue(null);
    const res = await createSeasonalRate(post('/api/seasonal-rates', validRate));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/rate plan/i);
  });

  it('rejects end date on or before start date', async () => {
    vi.mocked(prisma.ratePlan.findFirst).mockResolvedValue({ id: 'plan-1' } as any);
    const res = await createSeasonalRate(post('/api/seasonal-rates', { ...validRate, startDate: '2026-11-10', endDate: '2026-11-10' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/after start/i);
  });

  it('rejects negative prices', async () => {
    const res = await createSeasonalRate(post('/api/seasonal-rates', { ...validRate, price: -100 }));
    expect(res.status).toBe(400);
  });

  it('housekeeper cannot manage revenue rates', async () => {
    mockSession('HOUSEKEEPER');
    const res = await createSeasonalRate(post('/api/seasonal-rates', validRate));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/rate-restrictions', () => {
  beforeEach(() => mockSession());

  it('creates a minimum-length-of-stay restriction', async () => {
    vi.mocked(prisma.rateRestriction.create).mockResolvedValueOnce({ id: 'rr1' } as any);
    const res = await createRestriction(post('/api/rate-restrictions', {
      restrictionType: 'MIN_LOS', startDate: '2026-12-20', endDate: '2026-12-24', minLOS: 3,
    }));
    expect(res.status).toBe(201);
  });

  it('requires a known restriction type', async () => {
    const res = await createRestriction(post('/api/rate-restrictions', {
      restrictionType: 'MAGIC', startDate: '2026-12-20', endDate: '2026-12-24',
    }));
    expect(res.status).toBe(400);
  });
});
