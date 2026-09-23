'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Initial = { id?: string; name?: string; description?: string | null; basePrice?: number; isRefundable?: boolean; minStay?: number; maxStay?: number | null; mealsIncluded?: string; isActive?: boolean; property?: { name: string } | null };

export function RatePlanDialog({ mode, initial, properties, onClose }: { mode: 'create' | 'edit'; initial?: Initial; properties?: { id: string; name: string }[]; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === 'edit';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: form.get('propertyId') || null,
      name: form.get('name'),
      description: form.get('description') || null,
      basePrice: form.get('basePrice'),
      minStay: form.get('minStay'),
      maxStay: form.get('maxStay') || null,
      isRefundable: form.get('isRefundable') === 'on',
      mealsIncluded: form.get('mealsIncluded'),
      isActive: form.get('isActive') === 'on',
    };
    const url = isEdit ? `/api/rate-plans/${initial!.id}` : '/api/rate-plans';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(isEdit ? 'Updated' : 'Created');
    setOpen(false); onClose?.(); router.refresh();
  }

  const formInner = (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required defaultValue={initial?.name} placeholder="Flexible Rate" /></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="propertyId">Property (optional)</Label>
        <SelectHTML id="propertyId" name="propertyId" defaultValue="">
          <option value="">All properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
      </div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={2} defaultValue={initial?.description || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="basePrice">Base price / night</Label><Input id="basePrice" name="basePrice" type="number" step="0.01" required defaultValue={initial?.basePrice} /></div>
      <div className="space-y-1.5"><Label htmlFor="mealsIncluded">Meals</Label>
        <SelectHTML id="mealsIncluded" name="mealsIncluded" defaultValue={initial?.mealsIncluded || 'none'}>
          {['none','breakfast','half-board','full-board','all-inclusive'].map((m) => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="minStay">Min stay (nights)</Label><Input id="minStay" name="minStay" type="number" min={1} defaultValue={initial?.minStay ?? 1} /></div>
      <div className="space-y-1.5"><Label htmlFor="maxStay">Max stay (nights)</Label><Input id="maxStay" name="maxStay" type="number" min={1} defaultValue={initial?.maxStay ?? ''} placeholder="No limit" /></div>
      <div className="col-span-2 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isRefundable" defaultChecked={initial?.isRefundable ?? true} /> Refundable</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} /> Active</label>
      </div>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="button" variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </DialogFooter>
    </form>
  );

  if (isEdit) return <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}><DialogContent><DialogHeader><DialogTitle>Edit rate plan</DialogTitle></DialogHeader>{formInner}</DialogContent></Dialog>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New rate plan</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>New rate plan</DialogTitle></DialogHeader>{formInner}</DialogContent>
    </Dialog>
  );
}
