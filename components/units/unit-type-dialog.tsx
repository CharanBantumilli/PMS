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

type Initial = {
  id?: string; name?: string; description?: string | null;
  baseOccupancy?: number; maxOccupancy?: number;
  basePrice?: number; extraPersonFee?: number | null;
  bedType?: string; bedCount?: number; bathroomCount?: number;
};

export function UnitTypeDialog({ mode, initial, onClose }: { mode: 'create' | 'edit'; initial?: Initial; onClose?: () => void }) {
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
      description: form.get('description') || null,
      baseOccupancy: form.get('baseOccupancy'),
      maxOccupancy: form.get('maxOccupancy'),
      basePrice: form.get('basePrice'),
      extraPersonFee: form.get('extraPersonFee') || null,
      bedType: form.get('bedType'),
      bedCount: form.get('bedCount'),
      bathroomCount: form.get('bathroomCount'),
    };
    const url = isEdit ? `/api/unit-types/${initial!.id}` : '/api/unit-types';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not save'); return; }
    toast.success(isEdit ? 'Updated' : 'Created');
    setOpen(false);
    onClose?.();
    router.refresh();
  }

  const formInner = (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} placeholder="Deluxe King" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={initial?.description || ''} />
      </div>
      <div className="space-y-1.5"><Label htmlFor="basePrice">Base price / night</Label><Input id="basePrice" name="basePrice" type="number" step="0.01" required defaultValue={initial?.basePrice} /></div>
      <div className="space-y-1.5"><Label htmlFor="extraPersonFee">Extra person fee</Label><Input id="extraPersonFee" name="extraPersonFee" type="number" step="0.01" defaultValue={initial?.extraPersonFee ?? ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="baseOccupancy">Base occupancy</Label><Input id="baseOccupancy" name="baseOccupancy" type="number" min={1} required defaultValue={initial?.baseOccupancy ?? 2} /></div>
      <div className="space-y-1.5"><Label htmlFor="maxOccupancy">Max occupancy</Label><Input id="maxOccupancy" name="maxOccupancy" type="number" min={1} required defaultValue={initial?.maxOccupancy ?? 2} /></div>
      <div className="space-y-1.5"><Label htmlFor="bedType">Bed type</Label>
        <SelectHTML id="bedType" name="bedType" defaultValue={initial?.bedType || 'QUEEN'}>
          {['SINGLE','DOUBLE','QUEEN','KING','TWIN','BUNK','SOFA_BED','NONE'].map((b) => <option key={b} value={b}>{b.replace('_',' ')}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="bedCount">Bed count</Label><Input id="bedCount" name="bedCount" type="number" min={0} required defaultValue={initial?.bedCount ?? 1} /></div>
      <div className="space-y-1.5"><Label htmlFor="bathroomCount">Bathrooms</Label><Input id="bathroomCount" name="bathroomCount" type="number" min={0} required defaultValue={initial?.bathroomCount ?? 1} /></div>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="button" variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </DialogFooter>
    </form>
  );

  if (isEdit) {
    return <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}><DialogContent>{formInner}</DialogContent></Dialog>;
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New unit type</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New unit type</DialogTitle></DialogHeader>
        {formInner}
      </DialogContent>
    </Dialog>
  );
}
