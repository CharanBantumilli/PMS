import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as listIntegrations, POST as saveIntegration } from '@/app/api/integrations/route';
import { POST as testIntegrationRoute } from '@/app/api/integrations/test/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role,
    },
    expires: '2099-01-01',
  } as any);
  // apiContext verifies the org still exists
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}

const jsonReq = (path: string, body?: any) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });

// ---- GET /api/integrations ----
describe('GET /api/integrations', () => {
  beforeEach(() => mockSession());

  it('returns saved integrations with secrets masked', async () => {
    vi.mocked(prisma.integrationConfig.findMany).mockResolvedValueOnce([
      { id: 'i1', type: 'SMTP', name: 'Email SMTP', isEnabled: true, lastSyncAt: null, errorMessage: null,
        config: { host: 'smtp.gmail.com', port: 587, username: 'u', password: 'supersecretpassword99', fromEmail: 'f@f.in' } },
    ] as any);
    const res = await listIntegrations();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].config.password).toMatch(/^••••/);
    expect(JSON.stringify(body)).not.toContain('supersecretpassword99');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await listIntegrations();
    expect(res.status).toBe(401);
  });
});

// ---- POST /api/integrations (save / connect) ----
describe('POST /api/integrations', () => {
  beforeEach(() => mockSession());

  it('rejects non-admin roles', async () => {
    mockSession('RECEPTIONIST');
    const res = await saveIntegration(jsonReq('/api/integrations', { name: 'Email SMTP', type: 'SMTP' }));
    expect(res.status).toBe(403);
  });

  it('blocks enabling when required config fields are missing', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue(null);
    const res = await saveIntegration(jsonReq('/api/integrations', { name: 'Email SMTP', type: 'SMTP', isEnabled: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/SMTP host is required/);
  });

  it('saves a valid config and returns it masked', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.integrationConfig.upsert).mockImplementationOnce(((args: any) => {
      return Promise.resolve({
        id: 'i-new', type: 'SMTP', name: args.create.name, isEnabled: true,
        lastSyncAt: null, errorMessage: null, config: args.create.config,
      }) as any;
    }) as any);

    console.log('UPSERT CALLS SO FAR:', JSON.stringify(vi.mocked(prisma.integrationConfig.upsert).mock.calls));
    const res = await saveIntegration(jsonReq('/api/integrations', {
      name: 'Email SMTP', type: 'SMTP',
      config: { host: 'smtp.gmail.com', port: 587, username: 'u', password: 'brandnewtoken42', fromEmail: 'f@f.in' },
    }));
    console.log('UPSERT CALLS AFTER:', JSON.stringify(vi.mocked(prisma.integrationConfig.upsert).mock.calls));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.password).toMatch(/^••••/);
    expect(JSON.stringify(body)).not.toContain('brandnewtoken42');
    const upsertArgs = vi.mocked(prisma.integrationConfig.upsert).mock.calls.at(-1)![0] as any;
    expect(upsertArgs.create.config.password).toBe('brandnewtoken42');
  });

  it('merges masked re-saves with stored secrets instead of overwriting them', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue({
      id: 'i1', type: 'SMTP', organizationId: 'org-1',
      config: { host: 'smtp.gmail.com', port: 587, username: 'u', password: 'stored-secret-password', fromEmail: 'f@f.in' },
    } as any);
    vi.mocked(prisma.integrationConfig.upsert).mockImplementationOnce(((args: any) => {
      return Promise.resolve({ id: 'i1', type: 'SMTP', config: args.update.config } as any);
    }) as any);

    const res = await saveIntegration(jsonReq('/api/integrations', {
      name: 'Email SMTP', type: 'SMTP',
      config: { host: 'smtp.new.in', port: 465, username: 'u', password: '••••word99', fromEmail: 'f@f.in' },
    }));
    expect(res.status).toBe(200);
    const upsertArgs = vi.mocked(prisma.integrationConfig.upsert).mock.calls.at(-1)![0] as any;
    expect(upsertArgs.update.config.password).toBe('stored-secret-password');
    expect(upsertArgs.update.config.host).toBe('smtp.new.in');
  });

  it('rejects unknown integration types', async () => {
    const res = await saveIntegration(jsonReq('/api/integrations', { name: 'X', type: 'NOT_REAL' }));
    expect(res.status).toBe(400);
  });

  it('rejects unknown types without a preset definition card', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue(null);
    const res = await saveIntegration(jsonReq('/api/integrations', { name: 'Custom Webhook', type: 'CUSTOM_WEBHOOK', isEnabled: true, config: { url: 'https://x.dev/h' } }));
    expect(res.status).toBe(400);
  });
});

// ---- POST /api/integrations/test ----
describe('POST /api/integrations/test', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSession();
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requires a type', async () => {
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', {}));
    expect(res.status).toBe(400);
  });

  it('rejects unknown types before touching the database', async () => {
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'NOPE' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the integration has never been configured', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue(null);
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'STRIPE' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it('blocks managers? no — allows MANAGER but rejects RECEPTIONIST', async () => {
    mockSession('MANAGER');
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue({
      id: 'i1', type: 'STRIPE', config: { secretKey: 'sk_test_123' },
    } as any);
    const resOk = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'STRIPE' }));
    expect(resOk.status).toBe(200);

    mockSession('RECEPTIONIST');
    const resForbidden = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'STRIPE' }));
    expect(resForbidden.status).toBe(403);
  });

  it('reports incomplete configuration and persists the error message', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue({
      id: 'i1', type: 'SMTP', errorMessage: null, config: {},
    } as any);
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'SMTP' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/SMTP host is required/);
    expect(vi.mocked(prisma.integrationConfig.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1' }, data: { errorMessage: expect.stringContaining('SMTP host') } })
    );
  });

  it('stamps lastSyncAt and clears errorMessage on success', async () => {
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue({
      id: 'i1', type: 'STRIPE', errorMessage: 'old failure', config: { secretKey: 'sk_test_123' },
    } as any);
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'STRIPE' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const updateCall = vi.mocked(prisma.integrationConfig.update).mock.calls.at(-1)![0] as any;
    expect(updateCall.data.lastSyncAt).toBeInstanceOf(Date);
    expect(updateCall.data.errorMessage).toBeNull();
    expect(vi.mocked(prisma.activityLog.create)).toHaveBeenCalled();
  });

  it('persists provider failures so the UI can show an Error badge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key provided' } }) })));
    vi.mocked(prisma.integrationConfig.findUnique).mockResolvedValue({
      id: 'i1', type: 'STRIPE', errorMessage: null, config: { secretKey: 'sk_test_bad' },
    } as any);
    const res = await testIntegrationRoute(jsonReq('/api/integrations/test', { type: 'STRIPE' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toBe('Invalid API Key provided');
    const updateCall = vi.mocked(prisma.integrationConfig.update).mock.calls.at(-1)![0] as any;
    expect(updateCall.data.errorMessage).toBe('Invalid API Key provided');
  });
});
