// Single source of truth for integration definitions: fields, validation,
// secret masking and per-provider connectivity tests.

export type IntegrationFieldType = 'text' | 'password' | 'number' | 'select' | 'url';

export type IntegrationField = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required: boolean;
  secret?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
};

export type IntegrationDef = {
  type: string;
  name: string;
  testable: boolean; // can we run a real connectivity test?
  oauthOnly?: boolean;
  fields: IntegrationField[];
};

export const INTEGRATION_DEFS: Record<string, IntegrationDef> = {
  STRIPE: {
    type: 'STRIPE', name: 'Stripe', testable: true,
    fields: [
      { key: 'secretKey', label: 'Secret key', type: 'password', required: true, secret: true, placeholder: 'sk_live_… or sk_test_…' },
      { key: 'publishableKey', label: 'Publishable key', type: 'text', required: false, placeholder: 'pk_live_…' },
    ],
  },
  RAZORPAY: {
    type: 'RAZORPAY', name: 'Razorpay', testable: true,
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text', required: true, placeholder: 'rzp_live_… or rzp_test_…' },
      { key: 'keySecret', label: 'Key Secret', type: 'password', required: true, secret: true },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false, secret: true, help: 'Required for payment confirmation via webhooks' },
    ],
  },
  SMTP: {
    type: 'SMTP', name: 'Email (SMTP)', testable: true,
    fields: [
      { key: 'host', label: 'SMTP host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '587' },
      { key: 'secure', label: 'Use TLS (465)', type: 'select', required: false, options: [{ value: 'true', label: 'Yes (implicit TLS)' }, { value: 'false', label: 'No (STARTTLS)' }] },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true, secret: true },
      { key: 'fromEmail', label: 'From address', type: 'text', required: true, placeholder: 'reservations@yourhotel.in' },
      { key: 'fromName', label: 'From name', type: 'text', required: false, placeholder: 'Azure Bay Hotels' },
    ],
  },
  SLACK: {
    type: 'SLACK', name: 'Slack', testable: true,
    fields: [
      { key: 'mode', label: 'Connection mode', type: 'select', required: true, options: [{ value: 'bot', label: 'Bot token (recommended)' }, { value: 'webhook', label: 'Incoming webhook URL' }] },
      { key: 'botToken', label: 'Bot token (xoxb-…)', type: 'password', required: false, secret: true, help: 'Required for bot token mode' },
      { key: 'webhookUrl', label: 'Incoming webhook URL', type: 'url', required: false, help: 'Required for webhook mode' },
    ],
  },
  ZAPIER: {
    type: 'ZAPIER', name: 'Zapier', testable: true,
    fields: [
      { key: 'webhookUrl', label: 'Zapier webhook URL', type: 'url', required: true, placeholder: 'https://hooks.zapier.com/hooks/catch/…' },
    ],
  },
};

const SECRET_KEYS = new Set(['password', 'secretKey', 'authToken', 'accessToken', 'verifyToken', 'botToken', 'clientSecret']);

/** Replace secret values with a masked hint before sending configs to the client. */
export function maskConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!config) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEYS.has(k) && typeof v === 'string' && v.length > 0) {
      out[k] = v === '__SET__' ? '__SET__' : `••••${v.slice(-4)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Merge incoming config into stored config. Incoming values that are masked
 * placeholders ("••••1234" or "__SET__") keep the previously stored value so
 * users can edit other fields without re-entering secrets.
 */
export function mergeConfig(incoming: Record<string, unknown>, existing: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming)) {
    const isMasked = typeof v === 'string' && (v.startsWith('••••') || v === '__SET__');
    if (isMasked && SECRET_KEYS.has(k)) continue; // keep old
    out[k] = v === '' && SECRET_KEYS.has(k) ? '' : v;
  }
  return out;
}

export function validateConfig(type: string, config: Record<string, unknown>): { ok: boolean; error?: string } {
  const def = INTEGRATION_DEFS[type];
  if (!def) return { ok: false, error: 'Unknown integration type' };
  for (const f of def.fields) {
    if (!f.required) continue;
    const v = config[f.key];
    if (v === undefined || v === null || String(v).trim() === '') {
      // allow already-stored secrets to satisfy "required" when masked
      return { ok: false, error: `${f.label} is required` };
    }
    if (f.type === 'number' && isNaN(Number(v))) return { ok: false, error: `${f.label} must be a number` };
    if (f.type === 'url' && !/^https?:\/\//i.test(String(v))) return { ok: false, error: `${f.label} must be a valid URL` };
  }
  return { ok: true };
}

/** Block requests to private/internal IPs to prevent SSRF. */
export function isPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::1]' || hostname === '::1') return true;
    if (hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
    if (hostname.startsWith('172.')) {
      const octet = parseInt(hostname.split('.')[1], 10);
      if (octet >= 16 && octet <= 31) return true;
    }
    if (hostname === '169.254.169.254') return true; // cloud metadata
    if (u.protocol === 'file:') return true;
  } catch { return true; }
  return false;
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
}

async function postJson(url: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  let j: any = null;
  try { j = await res.json(); } catch {}
  return { status: res.status, json: j };
}

/** Run a real connectivity test against the provider using the stored config. */
export async function testIntegration(
  type: string,
  config: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  switch (type) {
    case 'STRIPE': {
      const key = String(config.secretKey);
      if (!key.startsWith('sk_')) return { ok: false, message: 'Secret key must start with sk_live_ or sk_test_' };
      try {
        const res = await fetchWithTimeout('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok) return { ok: true, message: 'Stripe credentials valid — balance retrieved' };
        const j: any = await res.json().catch(() => null);
        return { ok: false, message: j?.error?.message || `Stripe rejected the key (HTTP ${res.status})` };
      } catch (e: any) {
        return { ok: false, message: `Could not reach Stripe: ${e?.message || 'network error'}` };
      }
    }

    case 'RAZORPAY': {
      const keyId = String(config.keyId);
      const keySecret = String(config.keySecret);
      if (!keyId.startsWith('rzp_')) return { ok: false, message: 'Key ID must start with rzp_live_ or rzp_test_' };
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const res = await fetchWithTimeout('https://api.razorpay.com/v1/payments?count=1', {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (res.ok) return { ok: true, message: 'Razorpay credentials valid — API accessible' };
        if (res.status === 401) return { ok: false, message: 'Razorpay rejected the key ID / secret' };
        return { ok: false, message: `Razorpay returned HTTP ${res.status}` };
      } catch (e: any) {
        return { ok: false, message: `Could not reach Razorpay: ${e?.message || 'network error'}` };
      }
    }

    case 'SLACK': {
      const mode = String(config.mode || 'bot');
      if (mode === 'webhook') {
        const url = String(config.webhookUrl || '');
        if (!/^https:\/\/hooks\.slack\.com\//.test(url)) return { ok: false, message: 'Webhook URL must start with https://hooks.slack.com/' };
        const r = await postJson(url, { text: 'PMS connection test — Slack is connected.' });
        return r.status === 200
          ? { ok: true, message: 'Slack webhook delivered a test message' }
          : { ok: false, message: `Slack webhook failed (HTTP ${r.status})` };
      }
      const token = String(config.botToken || '');
      if (!token.startsWith('xoxb-')) return { ok: false, message: 'Bot tokens start with xoxb-' };
      try {
        const r = await postJson('https://slack.com/api/auth.test', {}, { Authorization: `Bearer ${token}` });
        if (r.json?.ok) return { ok: true, message: `Slack OK — connected as @${r.json.user} in ${r.json.team}` };
        return { ok: false, message: `Slack rejected the token: ${r.json?.error || 'unknown error' }` };
      } catch (e: any) {
        return { ok: false, message: `Could not reach Slack: ${e?.message || 'network error'}` };
      }
    }

    case 'ZAPIER': {
      const url = String(config.webhookUrl || '');
      if (!/^https:\/\/hooks\.zapier\.com\//.test(url)) return { ok: false, message: 'URL must be a Zapier hooks URL (https://hooks.zapier.com/…)' };
      const r = await postJson(url, { event: 'integration.test', source: 'pms', timestamp: new Date().toISOString() });
      return r.status >= 200 && r.status < 300
        ? { ok: true, message: 'Test payload delivered to your Zap' }
        : { ok: false, message: `Zapier webhook failed (HTTP ${r.status})` };
    }

    case 'SMTP': {
      const port = Number(config.port || 587);
      const secure = String(config.secure ?? 'false') === 'true';
      try {
        // Lazy-load so environments without SMTP still load this module fine
        const nodemailer = (await import('nodemailer')).default;
        const transport = nodemailer.createTransport({
          host: String(config.host),
          port,
          secure,
          auth: { user: String(config.username), pass: String(config.password) },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
        });
        await transport.verify();
        return { ok: true, message: `SMTP OK — connected to ${config.host}:${port}` };
      } catch (e: any) {
        const reason = e?.code === 'EAUTH' ? 'authentication failed (check username/password)'
          : e?.code === 'ECONNREFUSED' ? 'connection refused (wrong host/port?)'
          : e?.code === 'ETIMEDOUT' ? 'timed out'
          : e?.responseCode ? `server said ${e.responseCode}: ${e?.response || 'error'}`
          : e?.message || 'network error';
        return { ok: false, message: `SMTP failed — ${reason}` };
      }
    }

    default:
      return { ok: false, message: 'Unknown integration type' };
  }
}
