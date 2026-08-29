'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/dashboard';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@hotel.com" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="#" className="text-xs text-slate-600 hover:text-slate-900">Forgot password?</Link>
        </div>
        <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
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
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} PMS SaaS</p>
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
            <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
              <LoginForm />
            </Suspense>
            <p className="mt-6 text-center text-sm text-slate-600">
              Don't have an account? <Link href="/register" className="font-medium text-slate-900 hover:underline">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
