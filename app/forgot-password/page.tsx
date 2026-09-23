'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return; }
      setSent(true);
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Building2 className="h-5 w-5" /></div>
          <span className="text-xl font-bold">PMS</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Forgot your password?</h1>
          <p className="mt-4 max-w-md text-slate-300">No worries — we&apos;ll send you a reset link to get you back in.</p>
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
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>Enter your email address and we&apos;ll send you a link to reset your password.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> If an account exists with that email, a reset link has been sent.
                </div>
                <p className="text-sm text-slate-600">Check your inbox and click the link to set a new password. The link expires in 1 hour.</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@hotel.com" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} <Mail className="h-4 w-4 mr-1" /> Send reset link
                </Button>
              </form>
            )}
            <p className="mt-6 text-center text-sm text-slate-600">
              Remember your password? <Link href="/login" className="font-medium text-slate-900 hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
