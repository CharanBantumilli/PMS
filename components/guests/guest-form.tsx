'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Initial = {
  id?: string; firstName?: string; lastName?: string; email?: string | null; phone?: string | null;
  address?: string | null; city?: string | null; country?: string | null;
  idType?: string | null; idNumber?: string | null; dateOfBirth?: string | null;
  nationality?: string | null; vipLevel?: number; marketingOptIn?: boolean; notes?: string | null;
};

export function GuestForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: Initial }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body: any = {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      email: form.get('email') || null,
      phone: form.get('phone') || null,
      address: form.get('address') || null,
      city: form.get('city') || null,
      country: form.get('country') || null,
      idType: form.get('idType') || null,
      idNumber: form.get('idNumber') || null,
      dateOfBirth: form.get('dateOfBirth') || null,
      nationality: form.get('nationality') || null,
      vipLevel: Number(form.get('vipLevel') || 0),
      marketingOptIn: form.get('marketingOptIn') === 'on',
      notes: form.get('notes') || null,
    };
    const url = mode === 'create' ? '/api/guests' : `/api/guests/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not save'); return; }
    toast.success(mode === 'create' ? 'Guest created' : 'Guest updated');
    router.push(`/dashboard/guests/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5"><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required defaultValue={initial?.firstName} /></div>
      <div className="space-y-1.5"><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required defaultValue={initial?.lastName} /></div>
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={initial?.email || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={initial?.phone || ''} /></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={initial?.address || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="city">City</Label><Input id="city" name="city" defaultValue={initial?.city || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="country">Country</Label><Input id="country" name="country" defaultValue={initial?.country || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="nationality">Nationality</Label><Input id="nationality" name="nationality" defaultValue={initial?.nationality || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="dateOfBirth">Date of birth</Label><Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={initial?.dateOfBirth || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="idType">ID type</Label><Input id="idType" name="idType" defaultValue={initial?.idType || ''} placeholder="Passport, Driver's license" /></div>
      <div className="space-y-1.5"><Label htmlFor="idNumber">ID number</Label><Input id="idNumber" name="idNumber" defaultValue={initial?.idNumber || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="vipLevel">VIP level (0-5)</Label><Input id="vipLevel" name="vipLevel" type="number" min={0} max={5} defaultValue={initial?.vipLevel ?? 0} /></div>
      <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketingOptIn" defaultChecked={initial?.marketingOptIn} /> Marketing opt-in</label></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes || ''} /></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </div>
    </form>
  );
}
