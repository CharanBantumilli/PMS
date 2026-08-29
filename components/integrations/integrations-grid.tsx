'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, Settings2, PlugZap, CheckCircle2, ExternalLink, MessageCircle, Send, type LucideIcon } from 'lucide-react';
import {
  StripeIcon, WhatsAppIcon, TwilioIcon, EmailIcon, QuickBooksIcon, XeroIcon,
  SlackIcon, ZapierIcon, BookingComIcon, AirbnbIcon, WebhookBrandIcon, ApiKeyBrandIcon,
} from './brand-icons';
import toast from 'react-hot-toast';

type IntegrationConfig = Record<string, unknown> | null;

type Integration = {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  errorMessage: string | null;
  config?: IntegrationConfig;
};

type AvailableIntegration = {
  type: string;
  name: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  category: 'payments' | 'messaging' | 'accounting' | 'automation' | 'ota';
  realProvider: boolean; // whether this is a real provider vs placeholder
};

const AVAILABLE_INTEGRATIONS: AvailableIntegration[] = [
  { type: 'STRIPE', name: 'Stripe', description: 'Accept card payments, set up subscriptions and automate billing.', Icon: StripeIcon as any, category: 'payments', realProvider: true },
  { type: 'WHATSAPP', name: 'WhatsApp Business', description: 'Send booking confirmations, invoices, check-in reminders and review requests via WhatsApp.', Icon: WhatsAppIcon as any, category: 'messaging', realProvider: true },
  { type: 'SMTP', name: 'Email (SMTP)', description: 'Send transactional emails for bookings, invoices and invitations.', Icon: EmailIcon as any, category: 'messaging', realProvider: true },
  { type: 'TWILIO', name: 'Twilio SMS', description: 'Send SMS notifications for bookings, check-in reminders and OTPs.', Icon: TwilioIcon as any, category: 'messaging', realProvider: true },
  { type: 'QUICKBOOKS', name: 'QuickBooks', description: 'Sync invoices, payments and expenses with QuickBooks Online.', Icon: QuickBooksIcon as any, category: 'accounting', realProvider: true },
  { type: 'XERO', name: 'Xero', description: 'Two-way sync of financial data with Xero accounting.', Icon: XeroIcon as any, category: 'accounting', realProvider: true },
  { type: 'SLACK', name: 'Slack', description: 'Get real-time notifications in Slack channels for new bookings and incidents.', Icon: SlackIcon as any, category: 'automation', realProvider: true },
  { type: 'ZAPIER', name: 'Zapier', description: 'Connect to 5,000+ apps through Zapier workflows and webhooks.', Icon: ZapierIcon as any, category: 'automation', realProvider: true },
];

const FIELDS: Record<string, { key: string; label: string; input: string; required: boolean; help?: string; options?: { value: string; label: string }[]; placeholder?: string }[]> = {
  STRIPE: [
    { key: 'secretKey', label: 'Secret key', input: 'password', required: true, placeholder: 'sk_live_… / sk_test_…' },
    { key: 'publishableKey', label: 'Publishable key', input: 'text', required: false, placeholder: 'pk_live_…' },
  ],
  SMTP: [
    { key: 'host', label: 'SMTP host', input: 'text', required: true, placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', input: 'number', required: true, placeholder: '587' },
    { key: 'secure', label: 'TLS mode', input: 'select', required: false, options: [{ value: 'false', label: 'STARTTLS (port 587)' }, { value: 'true', label: 'Implicit TLS (port 465)' }] },
    { key: 'username', label: 'Username', input: 'text', required: true },
    { key: 'password', label: 'Password', input: 'password', required: true },
    { key: 'fromEmail', label: 'From address', input: 'text', required: true, placeholder: 'reservations@yourhotel.in' },
    { key: 'fromName', label: 'From name', input: 'text', required: false },
  ],
  TWILIO: [
    { key: 'accountSid', label: 'Account SID', input: 'text', required: true, placeholder: 'AC…' },
    { key: 'authToken', label: 'Auth token', input: 'password', required: true },
    { key: 'fromNumber', label: 'From number', input: 'text', required: true, placeholder: '+1415…' },
  ],
  WHATSAPP: [
    { key: 'phoneNumberId', label: 'Phone number ID', input: 'text', required: true, placeholder: '1234567890', help: 'From Meta Business Suite > WhatsApp > Phone Numbers' },
    { key: 'accessToken', label: 'Permanent access token', input: 'password', required: true, help: 'System user token from Meta Business Suite > System Users' },
    { key: 'businessAccountId', label: 'WhatsApp Business Account ID', input: 'text', required: false, placeholder: 'WAB…', help: 'Optional, used for template management' },
    { key: 'verifyToken', label: 'Webhook verify token', input: 'password', required: false, help: 'Any random string for webhook verification' },
  ],
  SLACK: [
    { key: 'mode', label: 'Connection mode', input: 'select', required: true, options: [{ value: 'bot', label: 'Bot token (recommended)' }, { value: 'webhook', label: 'Incoming webhook' }] },
    { key: 'botToken', label: 'Bot token (xoxb-…)', input: 'password', required: false, help: 'Required for bot token mode' },
    { key: 'webhookUrl', label: 'Webhook URL', input: 'url', required: false, help: 'Required for webhook mode' },
    { key: 'defaultChannel', label: 'Default channel', input: 'text', required: false, placeholder: '#reservations', help: 'Channel for notifications (e.g. #reservations)' },
  ],
  ZAPIER: [
    { key: 'webhookUrl', label: 'Zapier webhook URL', input: 'url', required: true, placeholder: 'https://hooks.zapier.com/hooks/catch/…' },
  ],
  QUICKBOOKS: [
    { key: 'realmId', label: 'Company (Realm) ID', input: 'text', required: true },
    { key: 'clientId', label: 'Client ID', input: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', input: 'password', required: true },
  ],
  XERO: [
    { key: 'tenantId', label: 'Tenant ID', input: 'text', required: true },
    { key: 'clientId', label: 'Client ID', input: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', input: 'password', required: true },
  ],
};

const OAUTH_NOTE: Record<string, string> = {
  QUICKBOOKS: 'QuickBooks uses OAuth. Save credentials here; connect via the OAuth consent flow to activate sync.',
  XERO: 'Xero uses OAuth. Save credentials here; connect via the OAuth consent flow to activate sync.',
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  messaging: 'Messaging',
  accounting: 'Accounting',
  automation: 'Automation',
  ota: 'OTAs',
};

const CATEGORY_ORDER = ['payments', 'messaging', 'automation', 'accounting'];

export function IntegrationsGrid({ integrations }: { integrations: Integration[] }) {
  const router = useRouter();
  const [configuring, setConfiguring] = useState<AvailableIntegration | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  async function toggle(type: string, currentEnabled: boolean) {
    const existing = integrations.find((i) => i.type === type);
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, name: AVAILABLE_INTEGRATIONS.find((a) => a.type === type)?.name || type, isEnabled: !currentEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(currentEnabled ? 'Disconnected' : 'Connected');
    router.refresh();
    void existing;
  }

  async function testConnection(type: string) {
    setTestingType(type);
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({ message: 'Unexpected response' }));
      if (!res.ok) toast.error(data.error || 'Test failed');
      else if (data.ok) toast.success(data.message || 'Connected');
      else toast.error(data.message || 'Test failed');
      if (res.ok) router.refresh();
    } finally {
      setTestingType(null);
    }
  }

  const configured = new Map(integrations.map((i) => [i.type, i]));
  const def = configuring ? FIELDS[configuring.type] : null;
  const initialConfig: Record<string, unknown> = (configuring && configured.get(configuring.type)?.config) || {};

  async function saveConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configuring) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const config: Record<string, unknown> = {};
    for (const f of def || []) {
      const v = form.get(f.key);
      if (v !== null) config[f.key] = typeof v === 'string' ? v.trim() : v;
    }
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: configuring.type, name: configuring.name, config }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(data.error || 'Save failed'); return; }
    toast.success('Settings saved — use Test to verify the connection');
    setConfiguring(null);
    router.refresh();
  }

  const filtered = filter === 'all' ? AVAILABLE_INTEGRATIONS : AVAILABLE_INTEGRATIONS.filter((i) => i.category === filter);

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('all')} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>All ({AVAILABLE_INTEGRATIONS.length})</button>
        {CATEGORY_ORDER.map((cat) => {
          const count = AVAILABLE_INTEGRATIONS.filter((i) => i.category === cat).length;
          if (count === 0) return null;
          return (
            <button key={cat} onClick={() => setFilter(cat)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === cat ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((av) => {
          const existing = configured.get(av.type);
          const isOn = existing?.isEnabled || false;
          const hasError = !!existing?.errorMessage;
          return (
            <Card key={av.type} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white">
                  <av.Icon size={28} />
                </div>
                {hasError ? (
                  <Badge variant="destructive" title={existing?.errorMessage || ''}>
                    <AlertTriangle className="mr-1 inline h-3 w-3" /> Error
                  </Badge>
                ) : isOn ? (
                  <Badge variant="success">
                    <CheckCircle2 className="mr-1 inline h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{av.name}</h3>
              <p className="mt-1 text-xs text-slate-600">{av.description}</p>
              {hasError && (
                <p className="mt-2 rounded-md bg-red-50 p-2 text-[11px] leading-snug text-red-700">{existing?.errorMessage}</p>
              )}
              {existing?.lastSyncAt && (
                <p className="mt-2 text-[10px] text-slate-400">Last test: {new Date(existing.lastSyncAt).toLocaleString()}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant={isOn ? 'outline' : 'default'} onClick={() => toggle(av.type, isOn)}>
                  {isOn ? 'Disconnect' : 'Connect'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfiguring(av)}>
                  <Settings2 className="mr-1 h-3.5 w-3.5" /> Configure
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!existing || testingType === av.type}
                  title={existing ? 'Run a real connectivity test' : 'Configure first'}
                  onClick={() => testConnection(av.type)}
                >
                  {testingType === av.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />} Test
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {configuring && def && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfiguring(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <configuring.Icon size={24} />
                Configure {configuring.name}
              </DialogTitle>
            </DialogHeader>
            {OAUTH_NOTE[configuring.type] && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">{OAUTH_NOTE[configuring.type]}</p>
            )}
            <form onSubmit={saveConfig} className="grid gap-3">
              {def.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`cfg-${f.key}`}>{f.label}{f.required ? ' *' : ''}</Label>
                  {f.input === 'select' ? (
                    <select
                      id={`cfg-${f.key}`}
                      name={f.key}
                      defaultValue={String(initialConfig[f.key] ?? f.options?.[0]?.value ?? '')}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <Input
                      id={`cfg-${f.key}`}
                      name={f.key}
                      type={f.input}
                      required={f.required}
                      placeholder={f.placeholder}
                      defaultValue={initialConfig[f.key] !== undefined && initialConfig[f.key] !== null ? String(initialConfig[f.key]) : ''}
                    />
                  )}
                  {f.help && <p className="text-xs text-slate-500">{f.help}</p>}
                </div>
              ))}
              <p className="text-xs text-slate-500">Saved secrets are stored securely and never sent back to your browser — you&apos;ll only see •••• last-4.</p>
              <DialogFooter className="mt-1">
                <Button type="button" variant="outline" onClick={() => setConfiguring(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save settings
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
