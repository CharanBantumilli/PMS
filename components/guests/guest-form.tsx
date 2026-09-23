'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2, Upload, FileCheck, X, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { PostalCodeInput } from '@/components/ui/postal-code-input';
import { DateInput } from '@/components/ui/date-input';
import { validateIdNumber } from '@/lib/validators';
import toast from 'react-hot-toast';

type Initial = {
  id?: string; firstName?: string; lastName?: string; email?: string | null; phone?: string | null;
  address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null;
  gstin?: string | null;
  idType?: string | null; idNumber?: string | null; idDocumentUrl?: string | null;
  dateOfBirth?: string | null; nationality?: string | null;
  vipLevel?: number; marketingOptIn?: boolean; notes?: string | null;
};

const ID_TYPES = [
  { value: '', label: 'Select ID type…' },
  { value: 'AADHAR', label: 'Aadhar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVER_LICENSE', label: "Driver's License" },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'SOCIAL_SECURITY', label: 'Social Security Card' },
  { value: 'MILITARY_ID', label: 'Military ID' },
  { value: 'OTHER', label: 'Other' },
];

export function GuestForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: Initial }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocUrl, setIdDocUrl] = useState(initial?.idDocumentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [phone, setPhone] = useState(initial?.phone || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode || '');
  const [showTax, setShowTax] = useState(false);
  const [idType, setIdType] = useState(initial?.idType || '');
  const [idNumber, setIdNumber] = useState(initial?.idNumber || '');
  const [idError, setIdError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateId() {
    if (!idType || !idNumber) { setIdError(''); return; }
    const err = validateIdNumber(idType, idNumber);
    setIdError(err || '');
  }

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'id-documents');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idType && idNumber) {
      const err = validateIdNumber(idType, idNumber);
      if (err) { setIdError(err); setLoading(false); return; }
    }
    setLoading(true);
    try {
      let finalDocUrl = idDocUrl;
      if (idDocFile) {
        setUploading(true);
        finalDocUrl = await uploadFile(idDocFile);
        setUploading(false);
      }

      const form = new FormData(e.currentTarget);
      const body: any = {
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        email: form.get('email') || null,
        phone: phone || null,
        address: form.get('address') || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        country: country || null,
        gstin: form.get('gstin') || null,
        idType: form.get('idType') || null,
        idNumber: form.get('idNumber') || null,
        idDocumentUrl: finalDocUrl || null,
        dateOfBirth: form.get('dateOfBirth') || null,
        nationality: form.get('nationality') || null,
        vipLevel: Number(form.get('vipLevel') || 0),
        marketingOptIn: form.get('marketingOptIn') === 'on',
        notes: form.get('notes') || null,
      };
      const url = mode === 'create' ? '/api/guests' : `/api/guests/${initial!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success(mode === 'create' ? 'Guest created' : 'Guest updated');
      router.push(`/dashboard/reservations/guests/${data.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Personal Information */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="firstName">First name *</Label><Input id="firstName" name="firstName" required defaultValue={initial?.firstName} /></div>
          <div className="space-y-1.5"><Label htmlFor="lastName">Last name *</Label><Input id="lastName" name="lastName" required defaultValue={initial?.lastName} /></div>
          <div className="space-y-1.5"><Label htmlFor="phone">Phone number *</Label><PhoneInput id="phone" name="phone" required value={phone} onChange={setPhone} /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={initial?.email || ''} /></div>
          <div className="space-y-1.5"><Label htmlFor="nationality">Nationality</Label><Input id="nationality" name="nationality" defaultValue={initial?.nationality || ''} placeholder="Indian" /></div>
          <div className="space-y-1.5"><Label htmlFor="dateOfBirth">Date of birth</Label><DateInput name="dateOfBirth" defaultValue={initial?.dateOfBirth || ''} /></div>
        </div>
      </div>

      {/* Identity Verification */}
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">Identity Verification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="idType">ID type *</Label>
            <SelectHTML id="idType" name="idType" required value={idType} onChange={(e) => { setIdType(e.target.value); setTimeout(validateId, 0); }}>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectHTML>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idNumber">ID number *</Label>
            <Input id="idNumber" name="idNumber" required value={idNumber} onChange={(e) => { setIdNumber(e.target.value); setTimeout(validateId, 0); }} placeholder="e.g. 1234-5678-9012" maxLength={50} className={idError ? 'border-red-500 focus-visible:ring-red-500' : ''} />
            {idError && <p className="text-xs text-red-600 mt-1">{idError}</p>}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>ID document (optional)</Label>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setIdDocFile(file); setIdDocUrl(''); }
              }} />
              {idDocFile ? (
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1 truncate">{idDocFile.name}</span>
                  <button type="button" onClick={() => setIdDocFile(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                </div>
              ) : idDocUrl ? (
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1 truncate">Document uploaded</span>
                  <a href={idDocUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600"><Eye className="h-4 w-4" /></a>
                  <button type="button" onClick={() => { setIdDocUrl(''); setIdDocFile(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload ID copy
                </Button>
              )}
              <span className="text-xs text-slate-500">JPEG, PNG or PDF — max 10 MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={initial?.address || ''} /></div>
          <div className="space-y-1.5"><Label htmlFor="city">City</Label><Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="state">State</Label><Input id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Maharashtra" /></div>
          <div className="space-y-1.5"><PostalCodeInput value={postalCode} onChange={setPostalCode} onFound={(d) => { setCity(d.city); setState(d.state); setCountry(d.country); }} /></div>
          <div className="space-y-1.5"><Label htmlFor="country">Country</Label><Input id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
        </div>
      </div>

      {/* Tax (GST) - collapsible */}
      <div className="rounded-md border border-slate-200">
        <button type="button" onClick={() => setShowTax(!showTax)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {showTax ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          Business / GST details
        </button>
        {showTax && (
          <div className="border-t border-slate-200 px-3 py-3">
            <div className="space-y-1.5"><Label htmlFor="gstin">GSTIN</Label><Input id="gstin" name="gstin" defaultValue={initial?.gstin || ''} placeholder="22AAAAA0000A1Z5" /></div>
          </div>
        )}
      </div>

      {/* Additional */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">Additional</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="vipLevel">VIP level (0–5)</Label><Input id="vipLevel" name="vipLevel" type="number" min={0} max={5} defaultValue={initial?.vipLevel ?? 0} /></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketingOptIn" defaultChecked={initial?.marketingOptIn} /> Marketing opt-in</label></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes || ''} /></div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading || uploading}>
          {(loading || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? 'Uploading…' : mode === 'create' ? 'Create guest' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
