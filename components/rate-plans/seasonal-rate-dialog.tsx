'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { DateInput } from '@/components/ui/date-input';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Initial = { id?: string; name?: string; ratePlanId?: string; propertyId?: string | null; startDate?: string; endDate?: string; price?: number; currency?: string; priority?: number; isActive?: boolean };

export function SeasonalRateDialog({ mode, initial, ratePlans, properties, onClose }: { mode: 'create' | 'edit'; initial?: Initial; ratePlans?: { id: string; name: string }[]; properties?: { id: string; name: string }[]; onClose?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = mode === 'edit';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      ratePlanId: form.get('ratePlanId'),
      propertyId: form.get('propertyId') || null,
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      price: form.get('price'),
      priority: Number(form.get('priority') || 0),
      isActive: form.get('isActive') === 'on',
    };
    const url = isEdit ? `/api/seasonal-rates/${initial!.id}` : '/api/seasonal-rates';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(isEdit ? 'Updated' : 'Created');
    onClose?.(); router.refresh();
  }

  const formInner = (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required defaultValue={initial?.name} placeholder="Summer Peak" /></div>
      <div className="space-y-1.5"><Label htmlFor="ratePlanId">Rate plan</Label>
        <SelectHTML id="ratePlanId" name="ratePlanId" required defaultValue={initial?.ratePlanId}>
          {ratePlans?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="propertyId">Property (optional)</Label>
        <SelectHTML id="propertyId" name="propertyId" defaultValue={initial?.propertyId || ''}>
          <option value="">All properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="startDate">Start date</Label><DateInput name="startDate" required defaultValue={initial?.startDate?.slice(0,10)} /></div>
      <div className="space-y-1.5"><Label htmlFor="endDate">End date</Label><DateInput name="endDate" required defaultValue={initial?.endDate?.slice(0,10)} minDate={initial?.startDate?.slice(0,10)} /></div>
      <div className="space-y-1.5"><Label htmlFor="price">Price / night</Label><Input id="price" name="price" type="number" step="0.01" required defaultValue={initial?.price} /></div>
      <div className="space-y-1.5"><Label htmlFor="priority">Priority</Label><Input id="priority" name="priority" type="number" defaultValue={initial?.priority ?? 0} /></div>
      <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} /> Active</label></div>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </DialogFooter>
    </form>
  );

  if (isEdit) return <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}><DialogContent><DialogHeader><DialogTitle>Edit seasonal rate</DialogTitle></DialogHeader>{formInner}</DialogContent></Dialog>;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New seasonal rate</DialogTitle></DialogHeader>
        {formInner}
      </DialogContent>
    </Dialog>
  );
}
