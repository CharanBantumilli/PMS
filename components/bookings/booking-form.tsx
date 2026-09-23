'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2, Plus, Upload, FileCheck, X, Eye, ShieldCheck, ShieldAlert, CalendarDays } from 'lucide-react';
import { validateIdNumber } from '@/lib/validators';
import { PhoneInput } from '@/components/ui/phone-input';
import { SingleMonthCalendar } from '@/components/ui/single-month-calendar';
import toast from 'react-hot-toast';
import { formatCurrency, nightsBetween } from '@/lib/utils';

type Property = { id: string; name: string };
type Guest = { id: string; firstName: string; lastName: string; email: string | null };
type GuestDetail = Guest & { phone: string | null; idType: string | null; idNumber: string | null; idDocumentUrl: string | null };
type RatePlan = { id: string; name: string; basePrice: number };
type Unit = { id: string; name: string; number: string; status: string; unitType?: { name: string } | null };

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

export function BookingForm({
  properties, guests, ratePlans, defaultPropertyId, defaultUnitId, defaultArrivalDate, currency = 'USD',
}: {
  properties: Property[]; guests: Guest[]; ratePlans: RatePlan[];
  defaultPropertyId?: string; defaultUnitId?: string; defaultArrivalDate?: string; currency?: string;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [unitId, setUnitId] = useState(defaultUnitId || '');
  const [arrivalDate, setArrivalDate] = useState(defaultArrivalDate || new Date().toISOString().slice(0, 10));
  const [departureDate, setDepartureDate] = useState(() => {
    if (defaultArrivalDate) {
      const d = new Date(defaultArrivalDate);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  });
  const [activeCalendar, setActiveCalendar] = useState<'arrival' | 'departure' | null>(null);
  const arrivalRef = useRef<HTMLDivElement>(null);
  const departureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCalendar) return undefined;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (activeCalendar === 'arrival' && arrivalRef.current && !arrivalRef.current.contains(target)) {
        setActiveCalendar(null);
      } else if (activeCalendar === 'departure' && departureRef.current && !departureRef.current.contains(target)) {
        setActiveCalendar(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCalendar]);
  const [unitRate, setUnitRate] = useState('');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [status, setStatus] = useState('CONFIRMED');
  const [source, setSource] = useState('DIRECT');
  const [specialRequests, setSpecialRequests] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', email: '', phone: '', idType: '', idNumber: '' });
  const [newGuestDocFile, setNewGuestDocFile] = useState<File | null>(null);
  const [newGuestDocUrl, setNewGuestDocUrl] = useState('');
  const [newGuestIdError, setNewGuestIdError] = useState('');
  const newGuestFileRef = useRef<HTMLInputElement>(null);

  function validateOverrideId() {
    if (!overrideIdType || !overrideIdNumber) { setOverrideIdError(''); return; }
    const err = validateIdNumber(overrideIdType, overrideIdNumber);
    setOverrideIdError(err || '');
  }

  function validateNewGuestId() {
    if (!newGuest.idType || !newGuest.idNumber) { setNewGuestIdError(''); return; }
    const err = validateIdNumber(newGuest.idType, newGuest.idNumber);
    setNewGuestIdError(err || '');
  }

  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [selectedGuestDetail, setSelectedGuestDetail] = useState<GuestDetail | null>(null);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [overrideIdType, setOverrideIdType] = useState('');
  const [overrideIdNumber, setOverrideIdNumber] = useState('');
  const [overrideIdError, setOverrideIdError] = useState('');
  const [overrideDocFile, setOverrideDocFile] = useState<File | null>(null);
  const [overrideDocUrl, setOverrideDocUrl] = useState('');
  const overrideFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!propertyId) { setUnits([]); return; }
    setLoadingUnits(true);
    const params = new URLSearchParams({ propertyId });
    if (arrivalDate) params.set('arrivalDate', arrivalDate);
    if (departureDate) params.set('departureDate', departureDate);
    fetch(`/api/units?${params}`).then((r) => r.json()).then((data) => {
      setUnits(data);
      setLoadingUnits(false);
    });
  }, [propertyId, arrivalDate, departureDate]);

  useEffect(() => {
    if (ratePlanId) {
      const r = ratePlans.find((x) => x.id === ratePlanId);
      if (r) setUnitRate(String(r.basePrice));
    }
  }, [ratePlanId, ratePlans]);

  useEffect(() => {
    if (!selectedGuestId || selectedGuestId === '__new__') {
      setSelectedGuestDetail(null);
      return;
    }
    setLoadingGuest(true);
    fetch(`/api/guests/${selectedGuestId}`).then((r) => r.json()).then((data) => {
      setSelectedGuestDetail(data);
      setOverrideIdType('');
      setOverrideIdNumber('');
      setOverrideDocFile(null);
      setOverrideDocUrl('');
      setLoadingGuest(false);
    }).catch(() => setLoadingGuest(false));
  }, [selectedGuestId]);

  const nights = nightsBetween(arrivalDate, departureDate);
  const numUnitRate = Number(unitRate) || 0;
  const numAdults = Number(adults) || 1;
  const numChildren = Number(children) || 0;
  const numDiscount = Number(discount) || 0;
  const numTax = Number(taxAmount) || 0;
  const subtotal = nights * numUnitRate;
  const discountAmount = subtotal * numDiscount / 100;
  const taxAmountCalc = (subtotal - discountAmount) * numTax / 100;
  const total = Math.max(0, subtotal - discountAmount + taxAmountCalc);

  const guestHasId = selectedGuestDetail?.idType && selectedGuestDetail?.idNumber;
  const effectiveIdType = overrideIdType || selectedGuestDetail?.idType || '';
  const effectiveIdNumber = overrideIdNumber || selectedGuestDetail?.idNumber || '';
  const effectiveDocUrl = overrideDocUrl || selectedGuestDetail?.idDocumentUrl || '';
  const idVerified = !!effectiveIdType && !!effectiveIdNumber;
  const needsId = selectedGuestId && selectedGuestId !== '__new__' && !guestHasId && !showNewGuest;

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'id-documents');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  async function createGuestAndContinue(): Promise<string> {
    let docUrl = newGuestDocUrl;
    if (newGuestDocFile) {
      docUrl = await uploadFile(newGuestDocFile);
    }
    const payload: any = { firstName: newGuest.firstName, lastName: newGuest.lastName };
    if (newGuest.email) payload.email = newGuest.email;
    if (newGuest.phone) payload.phone = newGuest.phone;
    if (newGuest.idType) payload.idType = newGuest.idType;
    if (newGuest.idNumber) payload.idNumber = newGuest.idNumber;
    if (docUrl) payload.idDocumentUrl = docUrl;
    const res = await fetch('/api/guests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create guest');
    return data.id;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (overrideIdType && overrideIdNumber) {
      const err = validateIdNumber(overrideIdType, overrideIdNumber);
      if (err) { setOverrideIdError(err); setSubmitting(false); return; }
    }
    if (showNewGuest && newGuest.idType && newGuest.idNumber) {
      const err = validateIdNumber(newGuest.idType, newGuest.idNumber);
      if (err) { setNewGuestIdError(err); setSubmitting(false); return; }
    }
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      let guestId = String(form.get('guestId') || '');
      if (guestId === '__new__') {
        guestId = await createGuestAndContinue();
      }
      if (!guestId) throw new Error('Please select a guest');

      if (!showNewGuest && guestId !== '__new__' && !idVerified) {
        throw new Error('Guest ID verification is required. Please provide ID type and number before creating a booking.');
      }

      let finalDocUrl = effectiveDocUrl;
      if (overrideDocFile) {
        finalDocUrl = await uploadFile(overrideDocFile);
      }

      const body: any = {
        propertyId, unitId: unitId || null, guestId, ratePlanId: ratePlanId || null,
        arrivalDate, departureDate, adults: numAdults, children: numChildren, source, status,
        unitRate: numUnitRate, discount: numDiscount, taxAmount: numTax, specialRequests: specialRequests || null, internalNotes: internalNotes || null,
      };
      if (idVerified) {
        body.guestIdType = effectiveIdType;
        body.guestIdNumber = effectiveIdNumber;
        body.idDocumentUrl = finalDocUrl || null;
      }

      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create booking');
      toast.success('Booking created');
      router.push(`/dashboard/reservations/bookings/${data.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Property + Dates + Room */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="propertyId">Property</Label>
          <SelectHTML id="propertyId" required value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setUnitId(''); }}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectHTML>
        </div>
        <div className="space-y-1.5">
          <Label>Arrival</Label>
          <div className="relative" ref={arrivalRef}>
            <button type="button" onClick={() => setActiveCalendar(activeCalendar === 'arrival' ? null : 'arrival')} className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span>{arrivalDate}</span>
            </button>
            {activeCalendar === 'arrival' && (
              <div className="absolute left-0 top-full z-50 mt-1">
                <SingleMonthCalendar
                  selected={arrivalDate}
                  onSelect={(d) => { setArrivalDate(d); if (d > departureDate) setDepartureDate(d); setActiveCalendar(null); }}
                  minDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Departure</Label>
          <div className="relative" ref={departureRef}>
            <button type="button" onClick={() => setActiveCalendar(activeCalendar === 'departure' ? null : 'departure')} className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span>{departureDate}</span>
              <span className="ml-auto text-xs text-slate-500">{nightsBetween(arrivalDate, departureDate)}n</span>
            </button>
            {activeCalendar === 'departure' && (
              <div className="absolute right-0 top-full z-50 mt-1">
                <SingleMonthCalendar
                  selected={departureDate}
                  onSelect={(d) => { setDepartureDate(d); setActiveCalendar(null); }}
                  minDate={arrivalDate}
                />
              </div>
            )}
          </div>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="unitId">Available rooms {units.length > 0 && <span className="text-xs font-normal text-slate-500">({units.length} available)</span>}</Label>
          <SelectHTML id="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={loadingUnits}>
            <option value="">{loadingUnits ? 'Checking availability…' : 'Unassigned'}</option>
            {units.map((u) => <option key={u.id} value={u.id}>#{u.number} {u.name}{u.unitType ? ` — ${u.unitType.name}` : ''}</option>)}
          </SelectHTML>
          {arrivalDate && departureDate && units.length === 0 && !loadingUnits && (
            <p className="text-xs text-amber-600">No available rooms for these dates. Try different dates or mark as Unassigned.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adults">Adults</Label>
          <Input id="adults" type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="children">Children</Label>
          <Input id="children" type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} />
        </div>
      </div>

      {/* Guest Selection */}
      <div className="space-y-1.5">
        <Label htmlFor="guestId">Guest</Label>
        <SelectHTML id="guestId" name="guestId" required defaultValue="" value={selectedGuestId} onChange={(e) => {
          setSelectedGuestId(e.target.value);
          setShowNewGuest(e.target.value === '__new__');
        }}>
          <option value="" disabled>Select a guest…</option>
          {guests.map((g) => <option key={g.id} value={g.id}>{g.lastName}, {g.firstName}{g.email ? ` · ${g.email}` : ''}</option>)}
          <option value="__new__">+ Create new guest</option>
        </SelectHTML>
      </div>

      {/* Existing Guest — ID Verification */}
      {selectedGuestId && selectedGuestId !== '__new__' && !showNewGuest && (
        <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
          {loadingGuest ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading guest details…</div>
          ) : selectedGuestDetail ? (
            <>
              {guestHasId ? (
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-emerald-700">ID verified</span>
                    <span className="ml-2 text-slate-600">{selectedGuestDetail.idType?.replace('_', ' ')}</span>
                    <span className="ml-1 font-mono text-xs text-slate-500">{selectedGuestDetail.idNumber}</span>
                    {selectedGuestDetail.idDocumentUrl && (
                      <a href={selectedGuestDetail.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-slate-400 hover:text-slate-600"><Eye className="inline h-3 w-3" /></a>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                    <div className="text-sm text-amber-700 font-medium">No ID on file — required for booking</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SelectHTML value={overrideIdType} onChange={(e) => { setOverrideIdType(e.target.value); setTimeout(validateOverrideId, 0); }}>
                      {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </SelectHTML>
                    <div>
                      <Input placeholder="ID number *" value={overrideIdNumber} onChange={(e) => { setOverrideIdNumber(e.target.value); setTimeout(validateOverrideId, 0); }} maxLength={50} className={overrideIdError ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                      {overrideIdError && <p className="text-xs text-red-600 mt-1">{overrideIdError}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input ref={overrideFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setOverrideDocFile(file); setOverrideDocUrl(''); }
                    }} />
                    {overrideDocFile ? (
                      <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs">
                        <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="flex-1 truncate max-w-[140px]">{overrideDocFile.name}</span>
                        <button type="button" onClick={() => setOverrideDocFile(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : overrideDocUrl ? (
                      <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs">
                        <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="flex-1">Document uploaded</span>
                        <button type="button" onClick={() => { setOverrideDocUrl(''); setOverrideDocFile(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => overrideFileRef.current?.click()}>
                        <Upload className="mr-1.5 h-3 w-3" /> Upload ID copy
                      </Button>
                    )}
                    <span className="text-xs text-slate-500">JPEG, PNG or PDF — max 10 MB</span>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* New Guest (inline) */}
      {showNewGuest && (
        <div className="rounded-md border bg-slate-50 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="First name *" value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} />
            <Input placeholder="Last name *" value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} />
            <PhoneInput placeholder="Phone *" value={newGuest.phone} onChange={(phone) => setNewGuest({ ...newGuest, phone })} />
            <Input placeholder="Email" type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
          </div>
          <div className="border-t border-dashed border-slate-200 pt-3">
            <div className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Identity Verification *</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectHTML value={newGuest.idType} onChange={(e) => { setNewGuest({ ...newGuest, idType: e.target.value }); setTimeout(validateNewGuestId, 0); }}>
                {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectHTML>
              <div>
                <Input placeholder="ID number *" value={newGuest.idNumber} onChange={(e) => { setNewGuest({ ...newGuest, idNumber: e.target.value }); setTimeout(validateNewGuestId, 0); }} maxLength={50} className={newGuestIdError ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                {newGuestIdError && <p className="text-xs text-red-600 mt-1">{newGuestIdError}</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input ref={newGuestFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setNewGuestDocFile(file); setNewGuestDocUrl(''); }
              }} />
              {newGuestDocFile ? (
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="flex-1 truncate max-w-[140px]">{newGuestDocFile.name}</span>
                  <button type="button" onClick={() => setNewGuestDocFile(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : newGuestDocUrl ? (
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="flex-1">Document uploaded</span>
                  <a href={newGuestDocUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600"><Eye className="h-3.5 w-3.5" /></a>
                  <button type="button" onClick={() => { setNewGuestDocUrl(''); setNewGuestDocFile(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => newGuestFileRef.current?.click()}>
                  <Upload className="mr-1.5 h-3 w-3" /> Upload ID copy
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!showNewGuest && (
        <div>
          <button type="button" className="text-xs font-medium text-slate-700 hover:underline" onClick={() => setShowNewGuest(true)}>
            <Plus className="inline h-3 w-3" /> Quick add guest
          </button>
        </div>
      )}

      {/* Rate + Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ratePlanId">Rate plan</Label>
          <SelectHTML id="ratePlanId" value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)}>
            <option value="">Custom rate</option>
            {ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name} · {formatCurrency(r.basePrice, currency)}</option>)}
          </SelectHTML>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitRate">Rate / night</Label>
          <Input id="unitRate" type="number" step="0.01" min={0} value={unitRate} onChange={(e) => setUnitRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount">Discount %</Label>
          <Input id="discount" type="number" step="0.01" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxAmount">Tax %</Label>
          <Input id="taxAmount" type="number" step="0.01" min={0} max={100} value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <SelectHTML id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELED','NO_SHOW'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </SelectHTML>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">Source</Label>
          <SelectHTML id="source" value={source} onChange={(e) => setSource(e.target.value)}>
            {['DIRECT','WALK_IN','PHONE','EMAIL','OTHER'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </SelectHTML>
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="specialRequests">Special requests</Label>
          <Textarea id="specialRequests" rows={2} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="internalNotes">Internal notes</Label>
          <Textarea id="internalNotes" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </div>
      </div>

      {/* Price Summary */}
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span>{nights} night{nights !== 1 ? 's' : ''} × {formatCurrency(numUnitRate, currency)}</span><span>{formatCurrency(subtotal, currency)}</span></div>
        {numDiscount > 0 && <div className="flex justify-between text-slate-600"><span>Discount ({numDiscount}%)</span><span>−{formatCurrency(discountAmount, currency)}</span></div>}
        {numTax > 0 && <div className="flex justify-between text-slate-600"><span>Tax ({numTax}%)</span><span>+{formatCurrency(taxAmountCalc, currency)}</span></div>}
        <div className="mt-1 flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting || (needsId && !idVerified)}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create booking
        </Button>
      </div>
      {needsId && !idVerified && (
        <p className="text-xs text-amber-600 text-right">Please provide guest ID to continue</p>
      )}
    </form>
  );
}
