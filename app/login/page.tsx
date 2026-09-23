'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, AlertCircle, Mail, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginMode = 'password' | 'otp';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawCallback = params.get('callbackUrl') || '/dashboard';
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/dashboard';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  async function sendOtp(email: string) {
    setSendingOtp(true);
    setError(null);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'LOGIN' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); setSendingOtp(false); return; }
      setOtpSent(true);
      setDebugCode(data.debug_code || null);
      toast.success(`OTP sent to ${email}`);
    } catch { setError('Network error'); }
    setSendingOtp(false);
  }

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    if (password.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return; }
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    toast.success('Welcome back!');
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleOtpLogin() {
    setError(null);
    if (otpCode.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    const emailInput = document.querySelector('#login-email') as HTMLInputElement;
    const email = emailInput?.value?.trim();
    if (!email) { setError('Email is required'); return; }

    setLoading(true);
    // Verify OTP
    const verifyRes = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, code: otpCode, purpose: 'LOGIN' }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.verified) {
      setError(verifyData.error || 'Invalid OTP');
      setLoading(false);
      return;
    }
    // Sign in with OTP token
    const signInRes = await signIn('credentials', { email, password: `otp:${otpCode}`, redirect: false, callbackUrl });
    setLoading(false);
    if (signInRes?.error) { setError('Sign in failed. Please try again.'); return; }
    toast.success('Welcome back!');
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={mode === 'password' ? handlePasswordLogin : (e) => { e.preventDefault(); handleOtpLogin(); }} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" name="email" type="email" required autoComplete="email" placeholder="you@hotel.com" />
      </div>

      {mode === 'password' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" onClick={() => { setMode('otp'); setError(null); }} className="text-xs text-slate-600 hover:text-slate-900">Use OTP instead</button>
          </div>
          <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-xs text-slate-600 hover:text-slate-900">Forgot password?</Link>
          </div>
        </div>
      )}

      {mode === 'otp' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="otp-code">One-time password</Label>
            <button type="button" onClick={() => { setMode('password'); setError(null); setOtpSent(false); setOtpCode(''); }} className="text-xs text-slate-600 hover:text-slate-900">Use password instead</button>
          </div>
          {!otpSent ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => {
              const emailInput = document.querySelector('#login-email') as HTMLInputElement;
              sendOtp(emailInput?.value || '');
            }} disabled={sendingOtp}>
              {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send OTP to my email
            </Button>
          ) : (
            <div className="space-y-2">
              <Input id="otp-code" type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-lg tracking-[0.3em]" autoFocus />
              {debugCode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>Dev mode:</strong> Your OTP code is <strong className="text-lg tracking-widest">{debugCode}</strong>
                </div>
              )}
              <Button type="button" variant="outline" className="w-full text-xs" onClick={() => sendOtp((document.querySelector('#login-email') as HTMLInputElement)?.value || '')} disabled={sendingOtp}>
                {sendingOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Resend OTP
              </Button>
            </div>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading || (mode === 'otp' && otpCode.length !== 6)}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} {mode === 'password' ? 'Sign in' : 'Verify & Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Building2 className="h-5 w-5" /></div>
          <span className="text-xl font-bold">PMS</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">The simplest way to run your properties.</h1>
          <p className="mt-4 max-w-md text-slate-300">Reservations, guests, housekeeping, finance — beautifully unified in one platform.</p>
        </div>
        <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} PMS SaaS</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-none">
          <CardHeader>
            <Link href="/" className="mb-2 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><Building2 className="h-4 w-4" /></div>
              <span className="text-lg font-bold">PMS</span>
            </Link>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Welcome back. Sign in to your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-sm text-slate-500">Loading...</div>}>
              <LoginForm />
            </Suspense>
            <p className="mt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account? <Link href="/register" className="font-medium text-slate-900 hover:underline">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
