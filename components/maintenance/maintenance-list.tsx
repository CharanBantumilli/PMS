'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_COLORS, statusLabel, formatDateTime, formatCurrency } from '@/lib/utils';
import { Wrench, User, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { MaintenanceDialog } from './maintenance-dialog';

type Ticket = {
  id: string; title: string; description: string;
  priority: string; status: string; category: string | null;
  estimatedCost: number | null; actualCost: number | null;
  scheduledFor: string | null; completedAt: string | null;
  unit: { id: string; number: string; name: string };
  property: { name: string };
  assignee: { id: string; name: string } | null;
  booking: { id: string; confirmationCode: string; guest: { firstName: string; lastName: string } } | null;
};

const PRIORITY_COLOR: Record<string, string> = { LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-blue-100 text-blue-700', HIGH: 'bg-amber-100 text-amber-700', URGENT: 'bg-red-100 text-red-700' };

export function MaintenanceList({ tickets, currency = 'USD' }: { tickets: Ticket[]; currency?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Ticket | null>(null);

  async function quickStatus(t: Ticket, status: string) {
    const res = await fetch(`/api/maintenance/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Updated');
    router.refresh();
  }

  return (
    <>
      <div className="space-y-2">
        {tickets.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-100 text-orange-700">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{t.title}</h3>
                    <Badge className={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                    {t.priority === 'URGENT' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{t.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span><Link href={`/dashboard/properties/units`} className="hover:underline">#{t.unit.number} {t.unit.name}</Link> · <Link href={`/dashboard/properties/units`} className="hover:underline">{t.property.name}</Link></span>
                    {t.booking && <span>· <Link href={`/dashboard/reservations/bookings/${t.booking.id}`} className="font-medium text-slate-700 hover:underline">{t.booking.confirmationCode}</Link> ({t.booking.guest.firstName} {t.booking.guest.lastName})</span>}
                    {t.category && <span>· {t.category}</span>}
                    {t.assignee && <span>· <User className="inline h-3 w-3" /> {t.assignee.name}</span>}
                    {t.scheduledFor && <span>· {formatDateTime(t.scheduledFor)}</span>}
                    {t.estimatedCost && <span>· Est. {formatCurrency(t.estimatedCost, currency)}</span>}
                    {t.actualCost && <span>· Actual {formatCurrency(t.actualCost, currency)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[t.status]}>{statusLabel(t.status)}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button>
                {t.status === 'OPEN' && <Button size="sm" variant="outline" onClick={() => quickStatus(t, 'IN_PROGRESS')}>Start</Button>}
                {t.status === 'IN_PROGRESS' && <Button size="sm" variant="success" onClick={() => quickStatus(t, 'COMPLETED')}>Complete</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && <EditDialog ticket={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      title: form.get('title'),
      description: form.get('description'),
      priority: form.get('priority'),
      status: form.get('status'),
      category: form.get('category') || null,
      assigneeId: form.get('assigneeId') || null,
      estimatedCost: form.get('estimatedCost') || null,
      actualCost: form.get('actualCost') || null,
      scheduledFor: form.get('scheduledFor') || null,
    };
    const res = await fetch(`/api/maintenance/${ticket.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Updated');
    onClose(); router.refresh();
  }
  return (
    <MaintenanceDialog
      mode="edit"
      initial={ticket}
      onClose={onClose}
      customForm={(close) => (
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><label className="text-sm font-medium">Title</label><input name="title" required defaultValue={ticket.title} className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="col-span-2 space-y-1.5"><label className="text-sm font-medium">Description</label><textarea name="description" required rows={3} defaultValue={ticket.description} className="w-full rounded-md border px-3 py-2 text-sm" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Priority</label>
            <select name="priority" defaultValue={ticket.priority} className="h-10 w-full rounded-md border px-3 text-sm">
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Status</label>
            <select name="status" defaultValue={ticket.status} className="h-10 w-full rounded-md border px-3 text-sm">
              {['OPEN','ASSIGNED','IN_PROGRESS','AWAITING_PARTS','COMPLETED','CANCELED'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Category</label><input name="category" defaultValue={ticket.category || ''} className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Scheduled</label><input name="scheduledFor" type="datetime-local" defaultValue={ticket.scheduledFor?.slice(0,16) || ''} className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Estimated cost</label><input name="estimatedCost" type="number" step="0.01" defaultValue={ticket.estimatedCost || ''} className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Actual cost</label><input name="actualCost" type="number" step="0.01" defaultValue={ticket.actualCost || ''} className="h-10 w-full rounded-md border px-3 text-sm" /></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      )}
    />
  );
}
