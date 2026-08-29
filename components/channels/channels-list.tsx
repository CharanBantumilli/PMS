'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Globe, RefreshCw, Pencil, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { formatDateTime, statusLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ChannelDialog } from './channel-dialog';

type Channel = {
  id: string; name: string; type: string; status: string;
  propertyId: string | null; markup: number; isEnabled: boolean;
  lastSyncAt: string | null; lastSyncStatus: string | null;
  errorCount: number; mappingCount: number;
};

const TYPE_LOGOS: Record<string, { label: string; bg: string }> = {
  BOOKING_COM: { label: 'Booking.com', bg: 'bg-blue-600' },
  AIRBNB: { label: 'Airbnb', bg: 'bg-red-500' },
  EXPEDIA: { label: 'Expedia', bg: 'bg-yellow-500' },
  AGODA: { label: 'Agoda', bg: 'bg-purple-600' },
  VRBO: { label: 'Vrbo', bg: 'bg-blue-500' },
  HOTELS_COM: { label: 'Hotels.com', bg: 'bg-red-600' },
  CUSTOM_ICAL: { label: 'iCal', bg: 'bg-slate-600' },
  CUSTOM_API: { label: 'Custom API', bg: 'bg-slate-700' },
};

export function ChannelsList({ channels, properties, units }: { channels: Channel[]; properties: { id: string; name: string }[]; units: { id: string; number: string; name: string; propertyId: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Channel | null>(null);

  async function toggle(ch: Channel) {
    const res = await fetch(`/api/channels/${ch.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isEnabled: !ch.isEnabled }) });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success(ch.isEnabled ? 'Channel paused' : 'Channel enabled');
    router.refresh();
  }

  async function sync(ch: Channel) {
    const res = await fetch(`/api/channels/${ch.id}/sync`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Sync failed'); return; }
    toast.success('Sync complete');
    router.refresh();
  }

  async function remove(ch: Channel) {
    if (!confirm(`Disconnect ${ch.name}? Mappings will be removed.`)) return;
    const res = await fetch(`/api/channels/${ch.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Disconnected');
    router.refresh();
  }

  return (
    <>
      <div className="space-y-3">
        {channels.map((c) => {
          const t = TYPE_LOGOS[c.type] || { label: c.type, bg: 'bg-slate-600' };
          return (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${t.bg}`}>
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{t.label}</Badge>
                    {c.isEnabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{c.mappingCount} unit mapping{c.mappingCount !== 1 ? 's' : ''}</span>
                    <span>· Markup {c.markup}%</span>
                    {c.lastSyncAt && <span>· <Clock className="inline h-3 w-3" /> {formatDateTime(c.lastSyncAt)}</span>}
                    {c.errorCount > 0 && <span className="text-red-600">· <AlertCircle className="inline h-3 w-3" /> {c.errorCount} errors</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Enabled</span>
                    <Switch checked={c.isEnabled} onCheckedChange={() => toggle(c)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => sync(c)}><RefreshCw className="h-3 w-3" /> Sync</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {editing && <ChannelDialog mode="edit" initial={editing} properties={properties} units={units} onClose={() => setEditing(null)} />}
    </>
  );
}
