import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as listChannels, POST as createChannel } from '@/app/api/channels/route';
import { DELETE as removeChannel, PATCH as updateChannel } from '@/app/api/channels/[id]/route';
import { POST as syncChannel } from '@/app/api/channels/[id]/sync/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role, isSuperAdmin: false,
    },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}


const validChannel = {
  name: 'Booking.com',
  type: 'BOOKING_COM',
  markup: 5,
};

describe('GET /api/channels', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('lists channels for the organization', async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValueOnce([
      { id: 'c-1', name: 'Booking.com' },
      { id: 'c-2', name: 'Airbnb' },
    ] as any);
    const res = await listChannels();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe('POST /api/channels', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('rejects HOUSEKEEPER role', async () => {
    // prisma mocks reset individually below
    mockSession();
    mockSession('HOUSEKEEPER');
    const req = new NextRequest('http://localhost:3000/api/channels', {
      method: 'POST',
      body: JSON.stringify(validChannel),
    });
    const res = await createChannel(req);
    expect(res.status).toBe(403);
  });

  it('rejects invalid type', async () => {
    const req = new NextRequest('http://localhost:3000/api/channels', {
      method: 'POST',
      body: JSON.stringify({ ...validChannel, type: 'INVALID' }),
    });
    const res = await createChannel(req);
    expect(res.status).toBe(400);
  });

  it('rejects markup > 100', async () => {
    const req = new NextRequest('http://localhost:3000/api/channels', {
      method: 'POST',
      body: JSON.stringify({ ...validChannel, markup: 150 }),
    });
    const res = await createChannel(req);
    expect(res.status).toBe(400);
  });

  it('creates a channel successfully', async () => {
    vi.mocked(prisma.channel.create).mockResolvedValueOnce({ id: 'c-1', ...validChannel } as any);
    const req = new NextRequest('http://localhost:3000/api/channels', {
      method: 'POST',
      body: JSON.stringify(validChannel),
    });
    const res = await createChannel(req);
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/channels/[id]', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('toggles isEnabled', async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce({ id: 'c-1', name: 'Test' } as any);
    vi.mocked(prisma.channel.update).mockResolvedValueOnce({ id: 'c-1', isEnabled: false } as any);

    const req = new NextRequest('http://localhost:3000/api/channels/c-1', {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled: false }),
    });
    const res = await updateChannel(req, { params: { id: 'c-1' } });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent channel', async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/channels/nope', {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled: true }),
    });
    const res = await updateChannel(req, { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/channels/[id]', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('deletes a channel', async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce({ id: 'c-1', name: 'Test' } as any);
    const req = new NextRequest('http://localhost:3000/api/channels/c-1', { method: 'DELETE' });
    const res = await removeChannel(req, { params: { id: 'c-1' } });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/channels/[id]/sync', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('triggers a sync and creates a log', async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce({ id: 'c-1' } as any);
    vi.mocked(prisma.channelSyncLog.create).mockResolvedValueOnce({ id: 'log-1' } as any);
    vi.mocked(prisma.unit.count).mockResolvedValueOnce(24);

    const req = new NextRequest('http://localhost:3000/api/channels/c-1/sync', { method: 'POST' });
    const res = await syncChannel(req, { params: { id: 'c-1' } });
    expect(res.status).toBe(200);
    expect(prisma.channelSyncLog.create).toHaveBeenCalled();
    expect(prisma.channel.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastSyncAt: expect.any(Date), errorCount: 0 }),
    }));
  });

  it('returns 404 for non-existent channel', async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/channels/nope/sync', { method: 'POST' });
    const res = await syncChannel(req, { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});
