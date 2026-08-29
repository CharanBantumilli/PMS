'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Property = { id: string; name: string };
type Unit = { id: string; number: string; name: string; propertyId: string };
type Initial = { id?: string; name?: string; type?: string; propertyId?: string | null; markup?: number; isEnabled?: boolean };

export function ChannelDialog({ mode, initial, properties, units, onClose }: { mode: 'create' | 'edit'; initial?: Initial; properties?: Property[]; units?: Unit[]; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === 'edit';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      type: form.get('type'),
      propertyId: form.get('propertyId') || null,
      markup: Number(form.get('markup') || 0),
      apiKey: form.get('apiKey') || null,
      apiSecret: form.get('apiSecret') || null,
      isEnabled: form.get('isEnabled') === 'on',
    };
    const url = isEdit ? `/api/channels/${initial!.id}` : '/api/channels';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(isEdit ? 'Updated' : 'Channel connected');
    setOpen(false); onClose?.(); router.refresh();
  }

  const formInner = (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5"><Label htmlFor="name">Display name</Label><Input id="name" name="name" required defaultValue={initial?.name} placeholder="My Booking.com" /></div>
      <div className="space-y-1.5"><Label htmlFor="type">Channel type</Label>
        <SelectHTML id="type" name="type" required defaultValue={initial?.type || 'BOOKING_COM'}>
          <option value="BOOKING_COM">Booking.com</option>
          <option value="AIRBNB">Airbnb</option>
          <option value="EXPEDIA">Expedia</option>
          <option value="AGODA">Agoda</option>
          <option value="VRBO">Vrbo</option>
          <option value="HOTELS_COM">Hotels.com</option>
          <option value="CUSTOM_ICAL">iCal / Vacation Rental</option>
          <option value="CUSTOM_API">Custom API</option>
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="propertyId">Property (optional)</Label>
        <SelectHTML id="propertyId" name="propertyId" defaultValue={initial?.propertyId || ''}>
          <option value="">All properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="markup">Channel markup (%)</Label><Input id="markup" name="markup" type="number" step="0.1" min={0} max={100} defaultValue={initial?.markup ?? 0} /></div>
      <div className="space-y-1.5"><Label htmlFor="apiKey">API key / Username</Label><Input id="apiKey" name="apiKey" defaultValue="" placeholder="Optional" /></div>
      <div className="space-y-1.5"><Label htmlFor="apiSecret">API secret / Password</Label><Input id="apiSecret" name="apiSecret" type="password" defaultValue="" placeholder="Optional" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isEnabled" defaultChecked={initial?.isEnabled ?? true} /> Enable sync</label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} {isEdit ? 'Save' : 'Connect'}</Button>
      </DialogFooter>
    </form>
  );

  if (isEdit) return <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}><DialogContent><DialogHeader><DialogTitle>Edit channel</DialogTitle></DialogHeader>{formInner}</DialogContent></Dialog>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Connect channel</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Connect a new channel</DialogTitle></DialogHeader>{formInner}</DialogContent>
    </Dialog>
  );
}
