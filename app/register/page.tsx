'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      organizationName: String(form.get('organizationName') || '').trim(),
      organizationSlug: String(form.get('organizationSlug') || '').trim().toLowerCase(),
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || ''),
      country: 'IN',
      currency: 'INR',
    };
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || 'Could not create your account.');
      return;
    }
    const signRes = await signIn('credentials', { email: body.email, password: body.password, redirect: false });
    setLoading(false);
    if (signRes?.error) {
      toast.success('Account created. Please sign in.');
      router.push('/login');
      return;
    }
    toast.success('Welcome to PMS!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Building2 className="h-5 w-5" /></div>
          <span className="text-xl font-bold">PMS</span>
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Start your 14-day free trial.</h1>
          <p className="mt-4 max-w-md text-slate-300">No credit card required. Full access to every module.</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            {['Unlimited units on trial', 'Full reporting suite', 'Email & in-app support', 'Import your existing data'].map((f) => (
              <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {f}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} PMS SaaS</p>
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
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="organizationName">Property / company name</Label>
                <Input id="organizationName" name="organizationName" required placeholder="Azure Bay Hotels" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationSlug">Workspace URL</Label>
                <div className="flex items-center">
                  <span className="rounded-l-md border border-r-0 bg-slate-50 px-3 py-2 text-sm text-slate-500">app.pms.io/</span>
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
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" defaultValue="IN" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
                  <span className="font-semibold text-slate-900">INR</span>
                  <span className="text-slate-500">— Indian Rupee (₹)</span>
                </div>
                <input type="hidden" name="currency" value="INR" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create workspace
              </Button>
              <p className="text-xs text-slate-500">By creating a workspace you agree to our Terms and Privacy Policy.</p>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account? <Link href="/login" className="font-medium text-slate-900 hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
