'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, AlertCircle, Check, Mail, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'details' | 'otp';

type Details = {
  organizationName: string;
  organizationSlug: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

function getPasswordChecks(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One digit', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const d: Details = {
      organizationName: String(form.get('organizationName') || '').trim(),
      organizationSlug: String(form.get('organizationSlug') || '').trim().toLowerCase(),
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim().toLowerCase(),
      password: String(form.get('password') || '').trim(),
      confirmPassword: String(form.get('confirmPassword') || '').trim(),
    };

    if (!d.email) { setError('Email is required'); return; }
    if (d.password !== d.confirmPassword) { setError('Passwords do not match'); return; }

    const passwordChecks = getPasswordChecks(d.password);
    if (!passwordChecks.every((c) => c.met)) {
      setError('Please fix the password requirements below');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...d, country: 'IN', currency: 'INR' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setDetails(d);
      setStep('otp');
      setDebugCode(data.debug_code || null);
      toast.success('Verification code sent to your email');
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  async function handleVerify() {
    setError(null);
    if (otpCode.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    if (!details) { setError('Session expired. Please go back.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: details.email, code: otpCode, purpose: 'REGISTER' }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setError(data.error || 'Invalid OTP');
        setLoading(false);
        return;
      }

      toast.success('Account activated! Welcome to PMS!');
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  async function handleResendOtp() {
    if (!details) return;
    setSendingOtp(true);
    setError(null);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: details.email, purpose: 'REGISTER' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to resend OTP');
      } else {
        if (data.debug_code) setDebugCode(data.debug_code);
        toast.success('Verification code resent');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSendingOtp(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Building2 className="h-5 w-5" /></div>
          <span className="text-xl font-bold">PMS</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Start your 2-day free trial.</h1>
          <p className="mt-4 max-w-md text-slate-300">No credit card required. Full access to every module.</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            {['All rooms & bookings', 'Full reporting suite', 'Email & in-app support', 'GST compliant invoicing'].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {f}</li>
            ))}
          </ul>
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
            <CardTitle className="text-2xl">Create your workspace</CardTitle>
            <CardDescription>Set up your property management workspace in under a minute.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {step === 'details' && (
              <form onSubmit={handleRegister} autoComplete="off" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Property / company name</Label>
                  <Input id="organizationName" name="organizationName" required placeholder="Azure Bay Hotels" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organizationSlug">Workspace URL</Label>
                  <div className="flex items-center">
                    <span className="rounded-l-md border border-r-0 bg-slate-50 px-3 py-2 text-sm text-slate-500">{typeof window !== 'undefined' ? window.location.hostname : 'your-domain'}/</span>
                    <Input id="organizationSlug" name="organizationSlug" required pattern="[a-z0-9-]+" className="rounded-l-none" placeholder="azure-bay" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" required placeholder="Alex Morgan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" placeholder="alex@azurebay.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                  {password.length > 0 && (
                    <div className="space-y-1">
                      {getPasswordChecks(password).map((check) => (
                        <div key={check.label} className={`flex items-center gap-1.5 text-xs ${check.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <Check className={`h-3 w-3 ${check.met ? 'opacity-100' : 'opacity-30'}`} /> {check.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  {confirmPassword.length > 0 && (
                    <div className={`text-xs ${password === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Register & Send Code <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <p className="text-xs text-slate-500">By creating a workspace you agree to our Terms and Privacy Policy.</p>
              </form>
            )}

            {step === 'otp' && (
              <div className="space-y-4">
                <button onClick={() => { setStep('details'); setOtpCode(''); setError(null); }} className="text-sm text-slate-600 hover:text-slate-900">&larr; Back to details</button>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <Mail className="mb-1 inline h-4 w-4" /> We sent a 6-digit code to <strong>{details?.email}</strong>
                </div>
                {debugCode && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <strong>Dev mode:</strong> Your OTP code is <strong className="text-lg tracking-widest">{debugCode}</strong>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input id="otp" type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-lg tracking-[0.3em]" autoFocus />
                </div>
                <Button className="w-full" onClick={handleVerify} disabled={loading || otpCode.length !== 6}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Verify & Activate Account
                </Button>
                <Button variant="outline" className="w-full" onClick={handleResendOtp} disabled={sendingOtp}>
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Resend OTP
                </Button>
              </div>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account? <Link href="/login" className="font-medium text-slate-900 hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
