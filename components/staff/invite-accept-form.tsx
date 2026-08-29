'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function InviteAcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = { token, name: form.get('name'), password: form.get('password') };
    const res = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setLoading(false); toast.error(data.error || 'Failed'); return; }
    const signRes = await signIn('credentials', { email, password: body.password as string, redirect: false });
    setLoading(false);
    if (signRes?.error) { toast.error('Please sign in.'); router.push('/login'); return; }
    toast.success('Welcome!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5"><Label>Email</Label><Input value={email} disabled /></div>
      <div className="space-y-1.5"><Label htmlFor="name">Your name</Label><Input id="name" name="name" required /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Choose a password</Label><Input id="password" name="password" type="password" required minLength={8} /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Accept invitation</Button>
    </form>
  );
}
