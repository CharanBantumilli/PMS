import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotification, notifyByRole, notifyOrganization } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

describe('createNotification', () => {
  beforeEach(() => {
    vi.mocked(prisma.notification.createMany).mockReset();
  });

  it('creates a notification for each user', async () => {
    await createNotification({
      organizationId: 'org-1',
      userIds: ['u1', 'u2', 'u3'],
      type: 'BOOKING_NEW',
      title: 'New booking',
      message: 'A guest just booked',
    });
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0];
    expect(call.data).toHaveLength(3);
    expect(call.data[0]).toMatchObject({
      organizationId: 'org-1',
      userId: 'u1',
      type: 'BOOKING_NEW',
      title: 'New booking',
    });
  });

  it('is a no-op when userIds is empty', async () => {
    await createNotification({
      organizationId: 'org-1',
      userIds: [],
      type: 'BOOKING_NEW',
      title: 'Test',
      message: 'Test',
    });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('applies default priority NORMAL when not specified', async () => {
    await createNotification({
      organizationId: 'org-1',
      userIds: ['u1'],
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test',
    });
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0];
    expect(call.data[0].priority).toBe('NORMAL');
  });

  it('preserves metadata and actionUrl', async () => {
    await createNotification({
      organizationId: 'org-1',
      userIds: ['u1'],
      type: 'PAYMENT_RECEIVED',
      title: 'Payment',
      message: 'Got money',
      priority: 'HIGH',
      entity: 'Payment',
      entityId: 'pay-1',
      actionUrl: '/dashboard/payments',
      metadata: { amount: 500 },
    });
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0];
    expect(call.data[0]).toMatchObject({
      priority: 'HIGH',
      entity: 'Payment',
      entityId: 'pay-1',
      actionUrl: '/dashboard/payments',
      metadata: { amount: 500 },
    });
  });
});

describe('notifyOrganization', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.notification.createMany).mockReset();
  });

  it('notifies all active users in an organization', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' },
    ] as any);

    await notifyOrganization({
      organizationId: 'org-1',
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1', status: 'ACTIVE' }),
    }));
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0];
    expect(call.data).toHaveLength(2);
  });

  it('excludes the actor from notifications', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

    await notifyOrganization({
      organizationId: 'org-1',
      exceptUserId: 'u-actor',
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        NOT: { id: 'u-actor' },
      }),
    }));
  });

  it('does not call createMany when there are no users', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);

    await notifyOrganization({
      organizationId: 'empty-org',
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test',
    });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe('notifyByRole', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.notification.createMany).mockReset();
  });

  it('queries users by role', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 'mgr-1' }] as any);

    await notifyByRole({
      organizationId: 'org-1',
      roles: ['OWNER', 'ADMIN', 'MANAGER'],
      type: 'BOOKING_NEW',
      title: 'Test',
      message: 'Test',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      }),
    }));
  });

  it('creates notifications for found users', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'm1' }, { id: 'm2' },
    ] as any);

    await notifyByRole({
      organizationId: 'org-1',
      roles: ['MANAGER'],
      type: 'MAINTENANCE_NEW',
      title: 'Test',
      message: 'Test',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data[0].type).toBe('MAINTENANCE_NEW');
  });
});
