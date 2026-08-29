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

export function RestrictionDialog({ mode, onClose }: { mode: 'create' | 'edit'; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      restrictionType: form.get('restrictionType'),
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      minLOS: form.get('minLOS') || null,
      maxLOS: form.get('maxLOS') || null,
      closedToArrival: form.get('closedToArrival') === 'on',
      closedToDeparture: form.get('closedToDeparture') === 'on',
      minAdvance: form.get('minAdvance') || null,
      maxAdvance: form.get('maxAdvance') || null,
      isActive: true,
    };
    const res = await fetch('/api/rate-restrictions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Created');
    setOpen(false); onClose?.(); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add restriction</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New restriction</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label htmlFor="restrictionType">Type</Label>
            <SelectHTML id="restrictionType" name="restrictionType" required defaultValue="MIN_LOS">
              <option value="MIN_LOS">Minimum length of stay</option>
              <option value="MAX_LOS">Maximum length of stay</option>
              <option value="CLOSED_TO_ARRIVAL">Closed to arrival</option>
              <option value="CLOSED_TO_DEPARTURE">Closed to departure</option>
              <option value="MIN_ADVANCE">Minimum advance booking</option>
              <option value="MAX_ADVANCE">Maximum advance booking</option>
            </SelectHTML>
          </div>
          <div className="space-y-1.5"><Label htmlFor="startDate">Start date</Label><Input id="startDate" name="startDate" type="date" required /></div>
          <div className="space-y-1.5"><Label htmlFor="endDate">End date</Label><Input id="endDate" name="endDate" type="date" required /></div>
          <div className="space-y-1.5"><Label htmlFor="minLOS">Min LOS (nights)</Label><Input id="minLOS" name="minLOS" type="number" min={1} /></div>
          <div className="space-y-1.5"><Label htmlFor="maxLOS">Max LOS (nights)</Label><Input id="maxLOS" name="maxLOS" type="number" min={1} /></div>
          <div className="space-y-1.5"><Label htmlFor="minAdvance">Min advance (days)</Label><Input id="minAdvance" name="minAdvance" type="number" min={0} /></div>
          <div className="space-y-1.5"><Label htmlFor="maxAdvance">Max advance (days)</Label><Input id="maxAdvance" name="maxAdvance" type="number" min={0} /></div>
          <div className="col-span-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="closedToArrival" /> Closed to arrival</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="closedToDeparture" /> Closed to departure</label>
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
