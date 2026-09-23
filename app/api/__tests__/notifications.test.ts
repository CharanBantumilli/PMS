import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as listNotifications } from '@/app/api/notifications/route';
import { PATCH as markRead, DELETE as dismiss } from '@/app/api/notifications/[id]/route';
import { GET as unreadCount } from '@/app/api/notifications/unread-count/route';
import { POST as markAllRead } from '@/app/api/notifications/mark-all-read/route';

function mockSession(role: string = 'MANAGER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role,
    },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}


describe('GET /api/notifications', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('lists notifications for the current user', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([
      { id: 'n-1', isRead: false },
      { id: 'n-2', isRead: true },
    ] as any);
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(1);

    const req = new NextRequest('http://localhost:3000/api/notifications');
    const res = await listNotifications(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(2);
    expect(body.unreadCount).toBe(1);
  });

  it('filters by unread=true', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(0);

    const req = new NextRequest('http://localhost:3000/api/notifications?unread=true');
    const res = await listNotifications(req);
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isRead: false }),
    }));
  });

  it('limits results to 200 max', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(0);

    const req = new NextRequest('http://localhost:3000/api/notifications?limit=1000');
    const res = await listNotifications(req);
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 200,
    }));
  });
});

describe('GET /api/notifications/unread-count', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('returns the unread count', async () => {
    vi.mocked(prisma.notification.count).mockReset();
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(5);
    const res = await unreadCount();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(5);
  });

  it('excludes expired notifications', async () => {
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(0);
    const res = await unreadCount();
    expect(prisma.notification.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.any(Array),
      }),
    }));
  });
});

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('marks a notification as read', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce({ id: 'n-1' } as any);
    vi.mocked(prisma.notification.update).mockResolvedValueOnce({ id: 'n-1', isRead: true } as any);

    const req = new NextRequest('http://localhost:3000/api/notifications/n-1', { method: 'PATCH' });
    const res = await markRead(req, { params: { id: 'n-1' } });
    expect(res.status).toBe(200);
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
    }));
  });

  it('returns 404 for non-existent notification', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/notifications/nope', { method: 'PATCH' });
    const res = await markRead(req, { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notifications/[id]', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('deletes a notification', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce({ id: 'n-1' } as any);
    const req = new NextRequest('http://localhost:3000/api/notifications/n-1', { method: 'DELETE' });
    const res = await dismiss(req, { params: { id: 'n-1' } });
    expect(res.status).toBe(200);
    expect(prisma.notification.delete).toHaveBeenCalled();
  });
});

describe('POST /api/notifications/mark-all-read', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('marks all unread notifications as read', async () => {
    vi.mocked(prisma.notification.updateMany).mockReset();
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 5 } as any);
    const req = new NextRequest('http://localhost:3000/api/notifications/mark-all-read', { method: 'POST' });
    const res = await markAllRead(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(5);
  });
});
