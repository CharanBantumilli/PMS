import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasRole, jsonOk, jsonError } from '@/lib/api';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

describe('auth integration: apiContext + hasRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hasRole returns true for OWNER on admin checks', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'OWNER' }, ['OWNER', 'ADMIN'])).toBe(true);
  });

  it('hasRole rejects HOUSEKEEPER on admin checks', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'HOUSEKEEPER' }, ['OWNER', 'ADMIN'])).toBe(false);
  });

  it('hasRole accepts RECEPTIONIST for booking operations', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'RECEPTIONIST' }, ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'])).toBe(true);
  });

  it('hasRole accepts HOUSEKEEPER for housekeeping operations', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'HOUSEKEEPER' }, ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'])).toBe(true);
  });

  it('hasRole accepts ACCOUNTANT for finance operations', () => {
    expect(hasRole({ organizationId: 'o', userId: 'u', role: 'ACCOUNTANT' }, ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'])).toBe(true);
  });
});

describe('API response helpers', () => {
  it('jsonOk produces 200 with JSON content-type', async () => {
    const res = jsonOk({ message: 'ok' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toEqual({ message: 'ok' });
  });

  it('jsonError produces 400 with error payload', async () => {
    const res = jsonError('Invalid input');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid input' });
  });

  it('jsonError accepts custom status', async () => {
    expect(jsonError('Unauthorized', 401).status).toBe(401);
    expect(jsonError('Forbidden', 403).status).toBe(403);
    expect(jsonError('Not found', 404).status).toBe(404);
    expect(jsonError('Server error', 500).status).toBe(500);
  });
});
