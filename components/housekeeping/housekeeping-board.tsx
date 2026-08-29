'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useRealtimeEvents } from '@/lib/use-realtime';
import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectHTML } from '@/components/ui/select-native';
import { Plus, Loader2, Clock, User, MapPin, Sparkles, Check } from 'lucide-react';
import { STATUS_COLORS, statusLabel, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

type Task = {
  id: string; type: string; status: string; priority: number;
  notes: string | null; scheduledFor: string | null;
  startedAt: string | null; completedAt: string | null;
  unit: { id: string; number: string; name: string };
  property: { name: string };
  assignee: { id: string; name: string } | null;
  booking: { confirmationCode: string; guest: string } | null;
};

const COLUMNS = [
  { key: 'PENDING', title: 'Pending', color: 'border-amber-300' },
  { key: 'IN_PROGRESS', title: 'In progress', color: 'border-blue-300' },
  { key: 'COMPLETED', title: 'Completed', color: 'border-emerald-300' },
  { key: 'INSPECTED', title: 'Inspected', color: 'border-purple-300' },
];

const TYPE_LABEL: Record<string, string> = { FULL_CLEAN: 'Full clean', TOUCH_UP: 'Touch up', TURNDOWN: 'Turndown', INSPECTION: 'Inspection', LINEN_CHANGE: 'Linen change', RESTOCK: 'Restock' };

export function HousekeepingBoard({ tasks, properties, units, staff, activePropertyId }: { tasks: Task[]; properties: { id: string; name: string }[]; units: { id: string; number: string; name: string; propertyId: string }[]; staff: { id: string; name: string }[]; activePropertyId?: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState(activePropertyId || 'all');
  const [newOpen, setNewOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const { connected } = useRealtimeEvents({
    onUnitStatusChanged: () => { setLiveCount((n) => n + 1); router.refresh(); },
    onBookingCreated: () => router.refresh(),
  });

  const filtered = useMemo(() => filter === 'all' ? tasks : tasks.filter((t) => {
    const u = units.find((x) => x.id === t.unit.id);
    return u?.propertyId === filter;
  }), [tasks, filter, units]);

  const grouped = useMemo(() => {
    const m: Record<string, Task[]> = {};
    COLUMNS.forEach((c) => (m[c.key] = []));
    filtered.forEach((t) => { (m[t.status] ||= []).push(t); });
    return m;
  }, [filtered]);

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/housekeeping/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
    toast.success('Updated');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectHTML value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-auto">
          <option value="all">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New task</Button>
        <div className="ml-auto flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 text-xs text-slate-500">
          <Radio className={`h-3 w-3 ${connected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          {connected ? 'Live' : 'Offline'} {liveCount > 0 && `· ${liveCount} update${liveCount > 1 ? 's' : ''}`}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = grouped[col.key] || [];
          return (
            <div key={col.key} className={`rounded-lg border bg-white ${col.color} border-t-4`}>
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="text-sm font-semibold text-slate-800">{col.title}</div>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="space-y-2 p-2 min-h-[200px]">
                {list.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No tasks</div>}
                {list.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-sm font-semibold text-slate-900">#{t.unit.number}</span>
                      </div>
                      <Badge variant={t.priority >= 8 ? 'destructive' : t.priority >= 5 ? 'warning' : 'secondary'} className="text-[10px]">P{t.priority}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{TYPE_LABEL[t.type] || t.type}</div>
                    <div className="mt-1 text-xs text-slate-500"><MapPin className="inline h-3 w-3" /> {t.property.name}</div>
                    {t.assignee && <div className="mt-1 text-xs text-slate-500"><User className="inline h-3 w-3" /> {t.assignee.name}</div>}
                    {t.booking && <div className="mt-1 text-xs text-slate-500">→ {t.booking.guest} ({t.booking.confirmationCode})</div>}
                    {t.scheduledFor && <div className="mt-1 text-xs text-slate-500"><Clock className="inline h-3 w-3" /> {formatDateTime(t.scheduledFor)}</div>}
                    <div className="mt-2 flex gap-1">
                      {col.key === 'PENDING' && <Button size="sm" variant="outline" onClick={() => changeStatus(t.id, 'IN_PROGRESS')}>Start</Button>}
                      {col.key === 'IN_PROGRESS' && <Button size="sm" variant="success" onClick={() => changeStatus(t.id, 'COMPLETED')}><Check className="h-3 w-3" /> Done</Button>}
                      {col.key === 'COMPLETED' && <Button size="sm" variant="outline" onClick={() => changeStatus(t.id, 'INSPECTED')}>Inspect</Button>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {newOpen && <NewTaskDialog properties={properties} units={units} staff={staff} defaultPropertyId={filter === 'all' ? properties[0]?.id : filter} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function NewTaskDialog({ properties, units, staff, defaultPropertyId, onClose }: { properties: { id: string; name: string }[]; units: { id: string; number: string; name: string; propertyId: string }[]; staff: { id: string; name: string }[]; defaultPropertyId?: string; onClose: () => void }) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const propertyUnits = units.filter((u) => u.propertyId === propertyId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      propertyId, unitId: form.get('unitId'),
      type: form.get('type'),
      priority: Number(form.get('priority') || 5),
      assigneeId: form.get('assigneeId') || null,
      scheduledFor: form.get('scheduledFor') || null,
      notes: form.get('notes') || null,
    };
    const res = await fetch('/api/housekeeping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Task created');
    onClose(); router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New housekeeping task</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Property</Label>
            <SelectHTML value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectHTML>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="unitId">Unit</Label>
            <SelectHTML id="unitId" name="unitId" required>
              {propertyUnits.map((u) => <option key={u.id} value={u.id}>#{u.number} {u.name}</option>)}
            </SelectHTML>
          </div>
          <div className="space-y-1.5"><Label htmlFor="type">Type</Label>
            <SelectHTML id="type" name="type" required defaultValue="FULL_CLEAN">
              {['FULL_CLEAN','TOUCH_UP','TURNDOWN','INSPECTION','LINEN_CHANGE','RESTOCK'].map((t) => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </SelectHTML>
          </div>
          <div className="space-y-1.5"><Label htmlFor="priority">Priority (1-10)</Label><Input id="priority" name="priority" type="number" min={1} max={10} defaultValue={5} /></div>
          <div className="space-y-1.5"><Label htmlFor="assigneeId">Assignee</Label>
            <SelectHTML id="assigneeId" name="assigneeId">
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectHTML>
          </div>
          <div className="space-y-1.5"><Label htmlFor="scheduledFor">Scheduled</Label><Input id="scheduledFor" name="scheduledFor" type="datetime-local" /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" /></div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
