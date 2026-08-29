'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Unit = { id: string; number: string; name: string; property: string };
type Staff = { id: string; name: string };

type Initial = { id?: string; title?: string; description?: string; priority?: string; status?: string; category?: string | null; unit?: { id: string }; assignee?: { id: string } | null; estimatedCost?: number | null; scheduledFor?: string | null; };

export function MaintenanceDialog({ mode, initial, units, staff, onClose, customForm }: { mode: 'create' | 'edit'; initial?: Initial; units?: Unit[]; staff?: Staff[]; onClose?: () => void; customForm?: (close: () => void) => React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === 'edit';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      unitId: form.get('unitId'),
      title: form.get('title'),
      description: form.get('description'),
      priority: form.get('priority') || 'MEDIUM',
      category: form.get('category') || null,
      assigneeId: form.get('assigneeId') || null,
      estimatedCost: form.get('estimatedCost') || null,
      scheduledFor: form.get('scheduledFor') || null,
    };
    const res = await fetch('/api/maintenance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Ticket created');
    setOpen(false); onClose?.(); router.refresh();
  }

  if (customForm) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose?.()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit maintenance ticket</DialogTitle></DialogHeader>
          {customForm(() => onClose?.())}
        </DialogContent>
      </Dialog>
    );
  }

  if (isEdit) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New ticket</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New maintenance ticket</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Unit</label>
            <select name="unitId" required className="h-10 w-full rounded-md border px-3 text-sm">
              {units?.map((u) => <option key={u.id} value={u.id}>#{u.number} · {u.property}</option>)}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5"><label className="text-sm font-medium">Title</label><input name="title" required className="h-10 w-full rounded-md border px-3 text-sm" placeholder="Leaking shower" /></div>
          <div className="col-span-2 space-y-1.5"><label className="text-sm font-medium">Description</label><textarea name="description" required rows={3} className="w-full rounded-md border px-3 py-2 text-sm" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Priority</label>
            <select name="priority" defaultValue="MEDIUM" className="h-10 w-full rounded-md border px-3 text-sm">
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Category</label><input name="category" className="h-10 w-full rounded-md border px-3 text-sm" placeholder="Plumbing" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Assignee</label>
            <select name="assigneeId" className="h-10 w-full rounded-md border px-3 text-sm">
              <option value="">Unassigned</option>
              {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Estimated cost</label><input name="estimatedCost" type="number" step="0.01" className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="col-span-2 space-y-1.5"><label className="text-sm font-medium">Scheduled</label><input name="scheduledFor" type="datetime-local" className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
