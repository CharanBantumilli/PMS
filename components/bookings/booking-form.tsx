'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, nightsBetween } from '@/lib/utils';

type Property = { id: string; name: string };
type Guest = { id: string; firstName: string; lastName: string; email: string | null };
type RatePlan = { id: string; name: string; basePrice: number };
type Unit = { id: string; name: string; number: string; status: string; unitType?: { basePrice: number; name: string } | null };

export function BookingForm({
  properties, guests, ratePlans, defaultPropertyId, defaultUnitId, currency = 'USD',
}: {
  properties: Property[]; guests: Guest[]; ratePlans: RatePlan[];
  defaultPropertyId?: string; defaultUnitId?: string; currency?: string;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [unitId, setUnitId] = useState(defaultUnitId || '');
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [departureDate, setDepartureDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [unitRate, setUnitRate] = useState(0);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [status, setStatus] = useState('CONFIRMED');
  const [source, setSource] = useState('DIRECT');
  const [specialRequests, setSpecialRequests] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [ratePlanId, setRatePlanId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  useEffect(() => {
    if (!propertyId) { setUnits([]); return; }
    setLoadingUnits(true);
    fetch(`/api/units?propertyId=${propertyId}`).then((r) => r.json()).then((data) => {
      setUnits(data);
      setLoadingUnits(false);
    });
  }, [propertyId]);

  useEffect(() => {
    if (unitId) {
      const u = units.find((x) => x.id === unitId);
      if (u?.unitType?.basePrice) setUnitRate(u.unitType.basePrice);
    }
  }, [unitId, units]);

  useEffect(() => {
    if (ratePlanId) {
      const r = ratePlans.find((x) => x.id === ratePlanId);
      if (r) setUnitRate(r.basePrice);
    }
  }, [ratePlanId, ratePlans]);

  const nights = nightsBetween(arrivalDate, departureDate);
  const subtotal = nights * unitRate;
  const total = Math.max(0, subtotal - discount + taxAmount);

  async function createGuestAndContinue(): Promise<string> {
    const res = await fetch('/api/guests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(newGuest) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create guest');
    return data.id;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      let guestId = String(form.get('guestId') || '');
      if (guestId === '__new__') {
        guestId = await createGuestAndContinue();
      }
      if (!guestId) throw new Error('Please select a guest');

      const body = {
        propertyId, unitId: unitId || null, guestId, ratePlanId: ratePlanId || null,
        arrivalDate, departureDate, adults, children, source, status,
        unitRate, discount, taxAmount, specialRequests: specialRequests || null, internalNotes: internalNotes || null,
      };
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create booking');
      toast.success('Booking created');
      router.push(`/dashboard/bookings/${data.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="propertyId">Property</Label>
        <SelectHTML id="propertyId" required value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setUnitId(''); }}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="arrivalDate">Arrival</Label>
        <Input id="arrivalDate" type="date" required value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="departureDate">Departure</Label>
        <Input id="departureDate" type="date" required value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="unitId">Unit (optional)</Label>
        <SelectHTML id="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={loadingUnits}>
          <option value="">Unassigned</option>
          {units.map((u) => <option key={u.id} value={u.id}>#{u.number} {u.name}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="adults">Adults</Label>
        <Input id="adults" type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="children">Children</Label>
        <Input id="children" type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="guestId">Guest</Label>
        <SelectHTML id="guestId" required defaultValue="">
          <option value="" disabled>Select a guest…</option>
          {guests.map((g) => <option key={g.id} value={g.id}>{g.lastName}, {g.firstName}{g.email ? ` · ${g.email}` : ''}</option>)}
          <option value="__new__">+ Create new guest</option>
        </SelectHTML>
      </div>
      {showNewGuest ? null : (
        <div className="col-span-2">
          <button type="button" className="text-xs font-medium text-slate-700 hover:underline" onClick={() => setShowNewGuest(true)}>
            <Plus className="inline h-3 w-3" /> Quick add guest
          </button>
        </div>
      )}
      {showNewGuest && (
        <div className="col-span-2 grid grid-cols-2 gap-3 rounded-md border bg-slate-50 p-3">
          <Input placeholder="First name" value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} />
          <Input placeholder="Last name" value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} />
          <Input placeholder="Email" type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
          <Input placeholder="Phone" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="ratePlanId">Rate plan</Label>
        <SelectHTML id="ratePlanId" value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)}>
          <option value="">Custom rate</option>
          {ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name} · {formatCurrency(r.basePrice, currency)}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="unitRate">Rate / night</Label>
        <Input id="unitRate" type="number" step="0.01" min={0} value={unitRate} onChange={(e) => setUnitRate(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="discount">Discount</Label>
        <Input id="discount" type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="taxAmount">Tax</Label>
        <Input id="taxAmount" type="number" step="0.01" min={0} value={taxAmount} onChange={(e) => setTaxAmount(Number(e.target.value))} />
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
          {['DIRECT','WALK_IN','PHONE','EMAIL','BOOKING_COM','AIRBNB','EXPEDIA','AGODA','VRBO','OTHER'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </SelectHTML>
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="specialRequests">Special requests</Label>
        <Textarea id="specialRequests" rows={2} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="internalNotes">Internal notes</Label>
        <Textarea id="internalNotes" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
      </div>
      <div className="col-span-2 rounded-md border bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span>{nights} night{nights !== 1 ? 's' : ''} × {formatCurrency(unitRate, currency)}</span><span>{formatCurrency(subtotal, currency)}</span></div>
        <div className="flex justify-between text-slate-600"><span>Discount</span><span>−{formatCurrency(discount, currency)}</span></div>
        <div className="flex justify-between text-slate-600"><span>Tax</span><span>+{formatCurrency(taxAmount, currency)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create booking</Button>
      </div>
    </form>
  );
}
