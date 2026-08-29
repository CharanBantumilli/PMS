'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Initial = {
  id?: string;
  name?: string;
  code?: string;
  type?: string;
  description?: string | null;
  starRating?: number | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  policies?: string | null;
};

export function PropertyForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: Initial }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body: any = {
      name: form.get('name'),
      code: form.get('code'),
      type: form.get('type'),
      description: form.get('description') || null,
      starRating: form.get('starRating') || null,
      addressLine1: form.get('addressLine1') || null,
      city: form.get('city') || null,
      state: form.get('state') || null,
      postalCode: form.get('postalCode') || null,
      country: form.get('country') || null,
      phone: form.get('phone') || null,
      email: form.get('email') || null,
      policies: form.get('policies') || null,
    };
    const url = mode === 'create' ? '/api/properties' : `/api/properties/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not save'); return; }
    toast.success(mode === 'create' ? 'Property created' : 'Property updated');
    router.push('/dashboard/properties');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} placeholder="Azure Bay Resort" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" required defaultValue={initial?.code} placeholder="ABR" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <SelectHTML id="type" name="type" required defaultValue={initial?.type || 'HOTEL'}>
          <option value="HOTEL">Hotel</option>
          <option value="HOSTEL">Hostel</option>
          <option value="APARTMENT">Apartment</option>
          <option value="VILLA">Villa</option>
          <option value="RESORT">Resort</option>
          <option value="BED_BREAKFAST">Bed &amp; Breakfast</option>
          <option value="VACATION_RENTAL">Vacation Rental</option>
          <option value="BOUTIQUE">Boutique</option>
        </SelectHTML>
      </div>
      <div className="space-y-2">
        <Label htmlFor="starRating">Star rating</Label>
        <SelectHTML id="starRating" name="starRating" defaultValue={initial?.starRating?.toString() || ''}>
          <option value="">Not rated</option>
          {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={initial?.phone || ''} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={initial?.description || ''} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={initial?.addressLine1 || ''} />
      </div>
      <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" name="city" defaultValue={initial?.city || ''} /></div>
      <div className="space-y-2"><Label htmlFor="state">State / Region</Label><Input id="state" name="state" defaultValue={initial?.state || ''} /></div>
      <div className="space-y-2"><Label htmlFor="postalCode">Postal code</Label><Input id="postalCode" name="postalCode" defaultValue={initial?.postalCode || ''} /></div>
      <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" defaultValue={initial?.country || ''} maxLength={2} placeholder="IN" /></div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={initial?.email || ''} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="policies">Policies</Label>
        <Textarea id="policies" name="policies" rows={3} defaultValue={initial?.policies || ''} placeholder="Cancellation, check-in, child, pet policies..." />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create property' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
