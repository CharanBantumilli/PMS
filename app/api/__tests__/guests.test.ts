import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as listGuests, POST as createGuest } from '@/app/api/guests/route';
import { PATCH as patchGuest, DELETE as deleteGuest } from '@/app/api/guests/[id]/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1', userId: string = 'user-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, email: 't@t.com', organizationId: orgId, organizationSlug: 'test', role },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}

const get = (p: string) => new NextRequest(`http://localhost:3000${p}`);
const post = (p: string, body: any) => new NextRequest(`http://localhost:3000${p}`, { method: 'POST', body: JSON.stringify(body) });
const patch = (p: string, body: any) => new NextRequest(`http://localhost:3000${p}`, { method: 'PATCH', body: JSON.stringify(body) });

describe('GET /api/guests — read access is open to every staff role', () => {
  beforeEach(() => {
    vi.mocked(prisma.guest.findMany).mockResolvedValue([{ id: 'g1' }, { id: 'g2' }] as any);
    vi.mocked(prisma.guest.count).mockResolvedValue(2);
  });

  for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPER']) {
    it(`${role} can list guests`, async () => {
      mockSession(role);
      const res = await listGuests(get('/api/guests'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });
  }

  it('401 without a session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await listGuests(get('/api/guests'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/guests — write roles', () => {
  beforeEach(() => mockSession());

  const valid = { firstName: 'Aarav', lastName: 'Sharma', email: 'aarav@example.in', country: 'IN' };

  it('receptionist can create guests (front-desk duty)', async () => {
    mockSession('RECEPTIONIST');
    vi.mocked(prisma.guest.create).mockResolvedValueOnce({ id: 'g-new', ...valid } as any);
    const res = await createGuest(post('/api/guests', valid));
    expect(res.status).toBe(201);
  });

  it('accountant cannot create guests (money role, not front desk)', async () => {
    mockSession('ACCOUNTANT');
    const res = await createGuest(post('/api/guests', valid));
    expect(res.status).toBe(403);
  });

  it('housekeeper cannot create guests', async () => {
    mockSession('HOUSEKEEPER');
    const res = await createGuest(post('/api/guests', valid));
    expect(res.status).toBe(403);
  });

  it('invalid ISO country rejected with a clear message', async () => {
    const res = await createGuest(post('/api/guests', { ...valid, country: 'ZZ' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ISO country/i);
  });

  it('lowercase country normalized to uppercase on save', async () => {
    vi.mocked(prisma.guest.create).mockResolvedValueOnce({ id: 'g2', ...valid, country: 'IN' } as any);
    await createGuest(post('/api/guests', { ...valid, country: 'in' }));
    expect(vi.mocked(prisma.guest.create).mock.calls.at(-1)![0].data.country).toBe('IN');
  });

  it('missing firstName rejected', async () => {
    const res = await createGuest(post('/api/guests', { lastName: 'Only' }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH & DELETE /api/guests/[id]', () => {
  it('housekeeper can correct a spelling via PATCH? no — housekeeping role has no guest write rights', async () => {
    mockSession('HOUSEKEEPER');
    const res = await patchGuest(patch('/api/guests/g1', { vipLevel: 1 }), { params: { id: 'g1' } });
    expect(res.status).toBe(403);
  });

  it('deleting a guest requires owner/admin — manager forbidden', async () => {
    mockSession('MANAGER');
    const res = await deleteGuest(get('/api/guests/g1') as any, { params: { id: 'g1' } });
    expect(res.status).toBe(403);
  });

  it('owner can delete and it is scoped to their org', async () => {
    mockSession('OWNER');
    vi.mocked(prisma.guest.findFirst).mockResolvedValue({ id: 'g1', organizationId: 'org-1', firstName: 'Aarav', lastName: 'Sharma' } as any);
    vi.mocked(prisma.guest.update).mockResolvedValueOnce({ id: 'g1' } as any);
    const res = await deleteGuest(new NextRequest('http://localhost:3000/api/guests/g1', { method: 'DELETE' }), { params: { id: 'g1' } });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.guest.update)).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { deletedAt: expect.any(Date) } });
  });

  it('guest from another org behaves as 404 (tenant isolation)', async () => {
    mockSession('OWNER');
    vi.mocked(prisma.guest.findFirst).mockResolvedValue(null);
    const res = await patchGuest(patch('/api/guests/other-org-guest', { vipLevel: 3 }), { params: { id: 'other-org-guest' } });
    expect(res.status).toBe(404);
  });
});
