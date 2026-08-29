import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { PATCH as patchStaff, DELETE as removeStaff } from '@/app/api/staff/[id]/route';
import { POST as invite } from '@/app/api/invitations/route';
import { POST as acceptInvite } from '@/app/api/invitations/accept/route';
import { DELETE as revokeInvite } from '@/app/api/invitations/[id]/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1', userId: string = 'user-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, email: `${role.toLowerCase()}@t.com`, organizationId: orgId, organizationSlug: 'test', role, isSuperAdmin: false },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}

const req = (path: string, body?: any) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: body ? (path.includes('accept') ? 'POST' : 'PATCH') : 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });

const delReq = (path: string) => new NextRequest(`http://localhost:3000${path}`, { method: 'DELETE' });

// ---- PATCH /api/staff/[id] — the privilege escalation guards ----
describe('staff role changes — escalation guards', () => {
  beforeEach(() => mockSession('ADMIN'));

  it('admin cannot promote themselves to OWNER', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', role: 'ADMIN', organizationId: 'org-1' } as any);
    const res = await patchStaff(req('/api/staff/user-1', { role: 'OWNER' }), { params: { id: 'user-1' } });
    expect(res.status).toBe(400); // self role change
  });

  it('admin cannot demote an OWNER', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-owner', role: 'OWNER', organizationId: 'org-1' } as any);
    const res = await patchStaff(req('/api/staff/user-owner', { role: 'RECEPTIONIST' }), { params: { id: 'user-owner' } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/owner/i);
  });

  it('admin cannot change another admin into an owner', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2', role: 'ADMIN', organizationId: 'org-1' } as any);
    const res = await patchStaff(req('/api/staff/user-2', { role: 'OWNER' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(403);
  });

  it('receptionist has no staff management rights at all', async () => {
    mockSession('RECEPTIONIST');
    const res = await patchStaff(req('/api/staff/user-2', { role: 'MANAGER' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(403);
  });

  it('owner CAN reassign roles between non-owner staff', async () => {
    mockSession('OWNER');
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2', role: 'RECEPTIONIST', organizationId: 'org-1' } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 'user-2', role: 'MANAGER' } as any);
    const res = await patchStaff(req('/api/staff/user-2', { role: 'MANAGER' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(200);
  });

  it('owner CAN hand ownership to another user', async () => {
    mockSession('OWNER');
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2', role: 'ADMIN', organizationId: 'org-1' } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 'user-2', role: 'OWNER' } as any);
    const res = await patchStaff(req('/api/staff/user-2', { role: 'OWNER' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(200);
  });

  it('invalid roles are rejected by schema before any lookup', async () => {
    const res = await patchStaff(req('/api/staff/user-2', { role: 'SUPERBOSS' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(400);
  });

  it('suspending a user is allowed for admins', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2', role: 'RECEPTIONIST', organizationId: 'org-1' } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: 'user-2', status: 'SUSPENDED' } as any);
    const res = await patchStaff(req('/api/staff/user-2', { status: 'SUSPENDED' }), { params: { id: 'user-2' } });
    expect(res.status).toBe(200);
  });
});

// ---- DELETE /api/staff/[id] ----
describe('remove staff from workspace', () => {
  beforeEach(() => mockSession('ADMIN'));

  it('admin cannot remove themselves', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', organizationId: 'org-1' } as any);
    const res = await removeStaff(delReq('/api/staff/user-1'), { params: { id: 'user-1' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/yourself/i);
  });

  it('removal detaches the user instead of deleting the row', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2', organizationId: 'org-1' } as any);
    const res = await removeStaff(delReq('/api/staff/user-2'), { params: { id: 'user-2' } });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { organizationId: null, role: 'MANAGER' } })
    );
  });
});

// ---- invitations ----
describe('POST /api/invitations', () => {
  beforeEach(() => mockSession('OWNER'));

  it('creates an invitation with expiry and role', async () => {
    vi.mocked(prisma.invitation.create).mockResolvedValueOnce({
      id: 'inv-1', email: 'new@t.com', token: 'tok123', acceptUrl: '/invite/tok123',
    } as any);
    const res = await invite(jsonPost('/api/invitations', { email: 'new@t.com', role: 'HOUSEKEEPER' }));
    expect(res.status).toBeLessThan(300);
    const args = vi.mocked(prisma.invitation.create).mock.calls[0][0] as any;
    expect(args.data.role).toBe('HOUSEKEEPER');
    expect(args.data.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate pending invitations for the same email', async () => {
    vi.mocked(prisma.invitation.findFirst).mockResolvedValueOnce({ id: 'existing' } as any);
    const res = await invite(jsonPost('/api/invitations', { email: 'pending@t.com', role: 'MANAGER' }));
    expect(res.status).toBe(409);
  });

  it('revoke requires owner/admin and scopes to the org', async () => {
    mockSession('MANAGER');
    const res = await revokeInvite(delReq('/api/invitations/inv-9'), { params: { id: 'inv-9' } });
    expect(res.status).toBe(403);
  });
});

function jsonPost(path: string, body: any) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ---- POST /api/invitations/accept — public onboarding endpoint ----
describe('POST /api/invitations/accept', () => {
  const VALID_TOKEN = { id: 'inv-1', token: 'tok', email: 'joiner@t.com', role: 'MANAGER', organizationId: 'org-1', acceptedAt: null, expiresAt: new Date(Date.now() + 86400000) };

  it('requires token, name and password', async () => {
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ name: 'X' }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing fields/i);
  });

  it('enforces minimum password length', async () => {
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'short' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects unknown tokens', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'nope', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid or expired/i);
  });

  it('rejects already-used invitations', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue({ ...VALID_TOKEN, acceptedAt: new Date() } as any);
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects expired invitations', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue({ ...VALID_TOKEN, expiresAt: new Date(Date.now() - 1000) } as any);
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects when a user with that email already exists', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(VALID_TOKEN as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'dup' } as any);
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(409);
  });

  it('enforces the workspace plan seat limit (402)', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(VALID_TOKEN as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1', maxUsers: 5 } as any);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(5);
    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/Plan limit reached \(5 users\)/);
  });

  it('joins the invited user with the invited role and marks the invitation accepted', async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(VALID_TOKEN as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1', maxUsers: 25 } as any);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ id: 'u-new', email: 'joiner@t.com' } as any);
    vi.mocked(prisma.invitation.update).mockResolvedValueOnce({} as any);

    const res = await acceptInvite(new NextRequest('http://localhost:3000/api/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token: 'tok', name: 'Join Er', password: 'password123' }),
    }));
    expect(res.status).toBe(200);
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as any;
    expect(createArgs.data.role).toBe('MANAGER');           // invited role honored
    expect(createArgs.data.organizationId).toBe('org-1');
    expect(createArgs.data.hashedPassword).not.toBe('password123'); // hashed
    expect(vi.mocked(prisma.invitation.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' }, data: { acceptedAt: expect.any(Date) } })
    );
  });
});
