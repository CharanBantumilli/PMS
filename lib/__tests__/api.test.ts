import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { apiContext, jsonOk, jsonError, hasRole, logActivity } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

vi.mocked(getServerSession).mockResolvedValue(null);

describe('apiContext', () => {
  beforeEach(() => {
    // prisma mocks reset individually below;
  });

  it('returns null when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const result = await apiContext();
    expect(result).toBeNull();
  });

  it('returns context with organizationId when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        organizationId: 'org-1',
        organizationSlug: 'test-org',
        role: 'MANAGER',
      },
      expires: '2099-01-01',
    } as any);
    const result = await apiContext();
    expect(result).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'MANAGER',
    });
  });
});

describe('jsonOk', () => {
  it('returns a NextResponse with JSON body and 200 status', async () => {
    const res = jsonOk({ foo: 'bar' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ foo: 'bar' });
  });

  it('accepts a custom status code', async () => {
    const res = jsonOk({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });
});

describe('jsonError', () => {
  it('returns a NextResponse with error message and status', async () => {
    const res = jsonError('Bad request', 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Bad request' });
  });

  it('defaults to status 400', async () => {
    const res = jsonError('Oops');
    expect(res.status).toBe(400);
  });
});

describe('hasRole', () => {
  it('returns true when role is in the list', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'MANAGER' }, ['OWNER', 'MANAGER'])).toBe(true);
  });

  it('returns false when role is not in the list', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'HOUSEKEEPER' }, ['OWNER', 'MANAGER'])).toBe(false);
  });
});

describe('logActivity', () => {
  beforeEach(() => {
    // prisma mocks reset individually below;
  });

  it('creates an activity log entry', async () => {
    await logActivity({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'CREATE',
      entity: 'Booking',
      entityId: 'b-1',
      description: 'Created booking',
    });
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Booking',
        entityId: 'b-1',
        description: 'Created booking',
      }),
    });
  });

  it('handles missing userId', async () => {
    await logActivity({
      organizationId: 'org-1',
      action: 'LOGIN',
      entity: 'User',
      description: 'Someone logged in',
    });
    expect(prisma.activityLog.create).toHaveBeenCalled();
  });
});
