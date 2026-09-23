'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { PostalCodeInput } from '@/components/ui/postal-code-input';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/card';

type Initial = { id: string; name: string; legalName?: string | null; taxId?: string | null; gstin?: string | null; sacCode?: string | null; email: string; phone?: string | null; website?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null; currency: string; timezone: string; locale: string; checkInTime: string; checkOutTime: string; brandName?: string | null; primaryColor?: string | null; };
type Usage = { units: number; properties: number; users: number; maxUnits: number; maxProperties: number; maxUsers: number };

export function OrganizationForm({ initial, usage }: { initial: Initial; usage: Usage }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(initial.phone || '');
  const [city, setCity] = useState(initial.city || '');
  const [state, setState] = useState(initial.state || '');
  const [country, setCountry] = useState(initial.country || '');
  const [postalCode, setPostalCode] = useState(initial.postalCode || '');
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body: any = {
      name: form.get('name'), legalName: form.get('legalName') || null, taxId: form.get('taxId') || null,
      gstin: form.get('gstin') || null, sacCode: form.get('sacCode') || null,
      email: form.get('email'), phone: phone || null, website: form.get('website') || null,
      addressLine1: form.get('addressLine1') || null, addressLine2: form.get('addressLine2') || null,
      city: city || null, state: state || null, postalCode: postalCode || null, country: country || null,
      currency: form.get('currency'), timezone: form.get('timezone'), locale: form.get('locale'),
      checkInTime: form.get('checkInTime'), checkOutTime: form.get('checkOutTime'),
      brandName: form.get('brandName') || null, primaryColor: form.get('primaryColor') || null,
    };
    const res = await fetch(`/api/organization`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Saved');
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><div className="text-xs uppercase text-slate-500">Properties</div><div className="text-lg font-bold">{usage.properties} / {usage.maxProperties}</div></div>
          <div><div className="text-xs uppercase text-slate-500">Units</div><div className="text-lg font-bold">{usage.units} / {usage.maxUnits}</div></div>
          <div><div className="text-xs uppercase text-slate-500">Users</div><div className="text-lg font-bold">{usage.users} / {usage.maxUsers}</div></div>
        </div>
      </CardContent></Card>
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5"><Label htmlFor="name">Organization name</Label><Input id="name" name="name" required defaultValue={initial.name} /></div>
        <div className="space-y-1.5"><Label htmlFor="legalName">Legal name</Label><Input id="legalName" name="legalName" defaultValue={initial.legalName || ''} /></div>
        <div className="space-y-1.5"><Label htmlFor="taxId">Tax ID</Label><Input id="taxId" name="taxId" defaultValue={initial.taxId || ''} /></div>
        <div className="space-y-1.5"><Label htmlFor="gstin">GSTIN</Label><Input id="gstin" name="gstin" defaultValue={initial.gstin || ''} placeholder="22AAAAA0000A1Z5" /></div>
        <div className="space-y-1.5"><Label htmlFor="sacCode">SAC Code</Label><Input id="sacCode" name="sacCode" defaultValue={initial.sacCode || '9961'} placeholder="9961" /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required defaultValue={initial.email} /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><PhoneInput id="phone" name="phone" value={phone} onChange={setPhone} /></div>
        <div className="col-span-2 space-y-1.5"><Label htmlFor="website">Website</Label><Input id="website" name="website" defaultValue={initial.website || ''} /></div>
        <div className="col-span-2 space-y-1.5"><Label htmlFor="addressLine1">Address</Label><Input id="addressLine1" name="addressLine1" defaultValue={initial.addressLine1 || ''} /></div>
        <div className="col-span-2 space-y-1.5"><Label htmlFor="addressLine2">Address line 2</Label><Input id="addressLine2" name="addressLine2" defaultValue={initial.addressLine2 || ''} /></div>
        <div className="space-y-1.5"><Label htmlFor="city">City</Label><Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="state">State / Region</Label><Input id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} /></div>
        <div className="space-y-1.5"><PostalCodeInput value={postalCode} onChange={setPostalCode} onFound={(d) => { setCity(d.city); setState(d.state); setCountry(d.country); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="country">Country (ISO)</Label><Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="IN" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">
            <span className="font-semibold text-slate-900">INR</span>
            <span className="text-slate-500">— Indian Rupee (₹)</span>
            <span className="ml-auto rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">Locked</span>
          </div>
          <input type="hidden" name="currency" value="INR" />
          <p className="text-xs text-slate-500">This workspace is configured to use Indian Rupee (₹) exclusively for all transactions, invoices and reports.</p>
        </div>
        <div className="space-y-1.5"><Label htmlFor="timezone">Timezone</Label><Input id="timezone" name="timezone" defaultValue={initial.timezone} /></div>
        <div className="space-y-1.5"><Label htmlFor="locale">Locale</Label><Input id="locale" name="locale" defaultValue={initial.locale} /></div>
        <div className="space-y-1.5"><Label htmlFor="checkInTime">Check-in time</Label><Input id="checkInTime" name="checkInTime" defaultValue={initial.checkInTime} /></div>
        <div className="space-y-1.5"><Label htmlFor="checkOutTime">Check-out time</Label><Input id="checkOutTime" name="checkOutTime" defaultValue={initial.checkOutTime} /></div>
        <div className="col-span-2 mt-2 text-sm font-semibold">Branding</div>
        <div className="space-y-1.5"><Label htmlFor="brandName">Display name</Label><Input id="brandName" name="brandName" defaultValue={initial.brandName || ''} /></div>
        <div className="space-y-1.5"><Label htmlFor="primaryColor">Primary color</Label><Input id="primaryColor" name="primaryColor" type="color" defaultValue={initial.primaryColor || '#0f172a'} /></div>
        <div className="col-span-2 flex justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button></div>
      </form>
    </div>
  );
}
