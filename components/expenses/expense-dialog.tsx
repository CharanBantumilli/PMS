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

type Initial = { id?: string; category?: string; description?: string; amount?: number; vendor?: string | null; expenseDate?: string; notes?: string | null; };

export function ExpenseDialog({ mode, initial, onClose }: { mode: 'create' | 'edit'; initial?: Initial; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === 'edit';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      category: form.get('category'),
      description: form.get('description'),
      amount: form.get('amount'),
      vendor: form.get('vendor') || null,
      expenseDate: form.get('expenseDate'),
      notes: form.get('notes') || null,
    };
    const url = isEdit ? `/api/expenses/${initial!.id}` : '/api/expenses';
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
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <SelectHTML id="category" name="category" required defaultValue={initial?.category || 'OTHER'}>
          {['UTILITIES','SUPPLIES','MAINTENANCE','SALARY','MARKETING','TAX','INSURANCE','FOOD_BEVERAGE','OTHER'].map((c) => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
        </SelectHTML>
      </div>
      <div className="space-y-1.5"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" min={0} required defaultValue={initial?.amount} /></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="description">Description</Label><Input id="description" name="description" required defaultValue={initial?.description} /></div>
      <div className="space-y-1.5"><Label htmlFor="vendor">Vendor</Label><Input id="vendor" name="vendor" defaultValue={initial?.vendor || ''} /></div>
      <div className="space-y-1.5"><Label htmlFor="expenseDate">Date</Label><Input id="expenseDate" name="expenseDate" type="date" required defaultValue={initial?.expenseDate?.slice(0,10) || new Date().toISOString().slice(0,10)} /></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={2} defaultValue={initial?.notes || ''} /></div>
      <DialogFooter className="col-span-2 mt-2">
        <Button type="button" variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </DialogFooter>
    </form>
  );

  if (isEdit) return <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}><DialogContent><DialogHeader><DialogTitle>Edit expense</DialogTitle></DialogHeader>{formInner}</DialogContent></Dialog>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New expense</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>{formInner}</DialogContent>
    </Dialog>
  );
}
