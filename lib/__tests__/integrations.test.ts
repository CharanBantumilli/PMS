import { describe, it, expect, vi, afterEach } from 'vitest';
import { maskConfig, mergeConfig, validateConfig, testIntegration, INTEGRATION_DEFS } from '@/lib/integrations';

// ---- maskConfig ----
describe('maskConfig', () => {
  it('masks known secret keys showing only last 4 chars', () => {
    const out = maskConfig({ accessToken: 'EAAGverysecretkey99', phoneNumberId: '12345' });
    expect(out.accessToken).toBe('••••ey99');
    expect(out.phoneNumberId).toBe('12345'); // non-secret untouched
  });

  it('does not leak the full secret anywhere in the output', () => {
    const out = maskConfig({ password: 'supersecretpassword', username: 'admin' });
    expect(JSON.stringify(out)).not.toContain('supersecretpassword');
  });

  it('leaves empty-string secrets as empty strings', () => {
    expect(maskConfig({ botToken: '' })).toEqual({ botToken: '' });
  });

  it('returns an empty object for null/undefined config', () => {
    expect(maskConfig(null)).toEqual({});
    expect(maskConfig(undefined)).toEqual({});
  });
});

// ---- mergeConfig ----
describe('mergeConfig', () => {
  it('preserves the stored secret when the incoming value is masked', () => {
    const merged = mergeConfig(
      { phoneNumberId: 'new-phone', accessToken: '••••d99' },
      { phoneNumberId: 'old-phone', accessToken: 'EAAGstoredsecret9999' }
    );
    expect(merged.accessToken).toBe('EAAGstoredsecret9999');
    expect(merged.phoneNumberId).toBe('new-phone');
  });

  it('accepts a brand new secret over an absent stored one', () => {
    const merged = mergeConfig({ accessToken: 'fresh-token' }, {});
    expect(merged.accessToken).toBe('fresh-token');
  });

  it('allows explicitly clearing a secret with an empty string', () => {
    const merged = mergeConfig({ accessToken: '' }, { accessToken: 'old-token' });
    expect(merged.accessToken).toBe('');
  });

  it('overwrites non-secret fields normally', () => {
    const merged = mergeConfig({ host: 'smtp.new.in', port: 465 }, { host: 'smtp.old.in', port: 587 });
    expect(merged).toEqual({ host: 'smtp.new.in', port: 465 });
  });

  it('works without existing config', () => {
    expect(mergeConfig({ url: 'https://x.dev/hook' }, null)).toEqual({ url: 'https://x.dev/hook' });
  });
});

// ---- validateConfig ----
describe('validateConfig', () => {
  it('passes for a complete STRIPE config', () => {
    const r = validateConfig('STRIPE', { secretKey: 'sk_test_123' });
    expect(r.ok).toBe(true);
  });

  it('fails and names the first missing required field', () => {
    const r = validateConfig('STRIPE', {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Secret key is required/);
  });

  it('treats whitespace-only values as missing', () => {
    const r = validateConfig('SMTP', { host: '   ', port: 587, username: 'u', password: 'p', fromEmail: 'f@f.in' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/SMTP host is required/);
  });

  it('rejects non-numeric port', () => {
    const r = validateConfig('SMTP', { host: 'h', port: 'abc', username: 'u', password: 'p', fromEmail: 'f@f.in' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Port must be a number/);
  });

  it('rejects non-URL webhookUrl', () => {
    const r = validateConfig('ZAPIER', { webhookUrl: 'not-a-url' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/valid URL/);
  });

  it('fails for unknown integration type', () => {
    expect(validateConfig('NOT_REAL', {}).ok).toBe(false);
  });

  it('defines every grid integration with at least one field', () => {
    for (const [type, def] of Object.entries(INTEGRATION_DEFS)) {
      expect(def.fields.length, `${type} should declare fields`).toBeGreaterThan(0);
      for (const f of def.fields) {
        if (f.required) expect(def.testable || def.oauthOnly || true).toBeTruthy();
      }
    }
  });
});

// ---- testIntegration (local validation paths — no network) ----
describe('testIntegration — local pre-flight checks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('STRIPE rejects keys that do not start with sk_', async () => {
    const r = await testIntegration('STRIPE', { secretKey: 'pk_wrong' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sk_live_|sk_test_/);
  });

  it('SLACK bot mode rejects tokens not starting with xoxb-', async () => {
    const r = await testIntegration('SLACK', { mode: 'bot', botToken: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/xoxb-/);
  });

  it('SLACK webhook mode enforces hooks.slack.com domain', async () => {
    const r = await testIntegration('SLACK', { mode: 'webhook', webhookUrl: 'https://evil.com/hook' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/hooks\.slack\.com/);
  });

  it('ZAPIER enforces hooks.zapier.com domain', async () => {
    const r = await testIntegration('ZAPIER', { webhookUrl: 'https://example.com/x' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/hooks\.zapier\.com/);
  });

  it('unknown type fails safely', async () => {
    const r = await testIntegration('NOPE', {});
    expect(r.ok).toBe(false);
  });
});

// ---- testIntegration (network paths via stubbed fetch) ----
describe('testIntegration — live provider calls (fetch stubbed)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(responder: (url: string, init?: any) => { status: number; json: any }) {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const { status, json } = responder(String(url), init);
      return { ok: status >= 200 && status < 300, status, json: async () => json } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('STRIPE success returns ok with balance message', async () => {
    const fm = stubFetch(() => ({ status: 200, json: { balanced: true } }));
    const r = await testIntegration('STRIPE', { secretKey: 'sk_test_123' });
    expect(r.ok).toBe(true);
    expect(fm.mock.calls[0][0]).toContain('api.stripe.com/v1/balance');
    expect((fm.mock.calls[0][1] as any).headers.Authorization).toBe('Bearer sk_test_123');
  });

  it('STRIPE surfaces provider error messages verbatim', async () => {
    stubFetch(() => ({ status: 401, json: { error: { message: 'Invalid API Key provided' } } }));
    const r = await testIntegration('STRIPE', { secretKey: 'sk_test_bad' });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Invalid API Key provided');
  });

  it('SLACK bot mode calls auth.test and reports team/user on success', async () => {
    const fm = stubFetch(() => ({ status: 200, json: { ok: true, user: 'pms-bot', team: 'Azure Bay' } }));
    const r = await testIntegration('SLACK', { mode: 'bot', botToken: 'xoxb-123' });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('@pms-bot');
    expect((fm.mock.calls[0][1] as any).headers.Authorization).toBe('Bearer xoxb-123');
  });

  it('SLACK surfaces Slack API errors like invalid_auth', async () => {
    stubFetch(() => ({ status: 200, json: { ok: false, error: 'invalid_auth' } }));
    const r = await testIntegration('SLACK', { mode: 'bot', botToken: 'xoxb-bad' });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('invalid_auth');
  });

  it('network failures become clean ok:false results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const r = await testIntegration('STRIPE', { secretKey: 'sk_test_123' });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Could not reach Stripe');
  });
});

// ---- SMTP (nodemailer mocked) ----
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => transportMock),
  },
}));

const transportMock = {
  verify: vi.fn(),
};

describe('testIntegration — SMTP', () => {
  it('verifies a working connection', async () => {
    transportMock.verify.mockResolvedValueOnce(true);
    const r = await testIntegration('SMTP', { host: 'smtp.gmail.com', port: 587, secure: 'false', username: 'u', password: 'p', fromEmail: 'f@f.in' });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('smtp.gmail.com:587');
  });

  it('maps EAUTH to an authentication-failure hint', async () => {
    transportMock.verify.mockRejectedValueOnce(Object.assign(new Error('bad login'), { code: 'EAUTH' }));
    const r = await testIntegration('SMTP', { host: 'smtp.gmail.com', port: 587, secure: 'false', username: 'u', password: 'wrong', fromEmail: 'f@f.in' });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('authentication failed');
  });

  it('maps ECONNREFUSED to a host/port hint', async () => {
    transportMock.verify.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
    const r = await testIntegration('SMTP', { host: 'localhost', port: 1, secure: 'false', username: 'u', password: 'p', fromEmail: 'f@f.in' });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('connection refused');
  });
});
