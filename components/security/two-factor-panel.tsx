'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function TwoFactorPanel({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function startSetup() {
    setLoading(true);
    const res = await fetch('/api/2fa/setup', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    setSecret(data.secret);
    setStep('verify');
  }

  async function verify() {
    setLoading(true);
    const res = await fetch('/api/2fa/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error || 'Invalid code'); return; }
    setBackupCodes(data.backupCodes || []);
    setStep('idle');
    toast.success('Two-factor authentication enabled');
    router.refresh();
  }

  async function disable() {
    if (!confirm('Disable two-factor authentication?')) return;
    setLoading(true);
    const res = await fetch('/api/2fa/disable', { method: 'POST' });
    setLoading(false);
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('2FA disabled');
    router.refresh();
  }

  if (step === 'verify' && secret) {
    return (
      <div className="space-y-4 max-w-md">
        <div className="rounded-md border bg-slate-50 p-4">
          <div className="text-sm font-medium">Setup authenticator app</div>
          <p className="mt-1 text-xs text-slate-600">Scan this secret in your authenticator app (Google Authenticator, Authy, 1Password):</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm break-all">{secret}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Enter the 6-digit code from your app</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="123456" className="font-mono text-center text-lg" />
          <Button onClick={verify} disabled={loading || code.length !== 6} className="w-full">{loading ? 'Verifying…' : 'Verify and enable'}</Button>
        </div>
        <Button variant="ghost" onClick={() => setStep('idle')}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-md border bg-slate-50 p-4">
        <Shield className={`h-8 w-8 ${enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="font-semibold text-slate-900">{enabled ? 'Two-factor is enabled' : 'Two-factor is disabled'}</div>
          <p className="text-xs text-slate-600 mt-1">
            {enabled ? 'Your account is protected with an authenticator app.' : 'Add an extra layer of security by requiring a code from your authenticator app when signing in.'}
          </p>
        </div>
        {enabled ? (
          <Button variant="outline" onClick={disable} disabled={loading}>Disable</Button>
        ) : (
          <Button onClick={startSetup} disabled={loading}>{loading ? 'Setting up…' : 'Enable 2FA'}</Button>
        )}
      </div>
      {backupCodes.length > 0 && (
        <div className="rounded-md border bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Save your backup codes</div>
          <p className="mt-1 text-xs text-amber-800">Use these if you lose access to your authenticator. Each code works once.</p>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
            {backupCodes.map((c) => <code key={c} className="rounded bg-white px-2 py-1">{c}</code>)}
          </div>
        </div>
      )}
    </div>
  );
}
