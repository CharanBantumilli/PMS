'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2 } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { PostalCodeInput } from '@/components/ui/postal-code-input';
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
  const [phone, setPhone] = useState(initial?.phone || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode || '');

  function handlePostalFound(data: { city: string; state: string; country: string }) {
    setCity(data.city);
    setState(data.state);
    setCountry(data.country);
  }

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
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      country: country || null,
      phone: phone || null,
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
        <PhoneInput id="phone" name="phone" value={phone} onChange={setPhone} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={initial?.description || ''} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={initial?.addressLine1 || ''} />
      </div>
      <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="state">State / Region</Label><Input id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} /></div>
      <div className="space-y-2">
        <PostalCodeInput value={postalCode} onChange={setPostalCode} onFound={handlePostalFound} required />
      </div>
      <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="IN" /></div>
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
