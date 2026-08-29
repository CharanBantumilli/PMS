'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Webhook, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

type WebhookType = { id: string; name: string; url: string; events: string[]; isActive: boolean; createdAt: string };
type Delivery = { id: string; webhookId: string; webhookName: string; event: string; status: string; response: number | null; duration: number | null; createdAt: string };

export function WebhooksList({ webhooks, deliveries }: { webhooks: WebhookType[]; deliveries: Delivery[] }) {
  const router = useRouter();

  async function remove(w: WebhookType) {
    if (!confirm(`Delete webhook "${w.name}"?`)) return;
    const res = await fetch(`/api/webhooks/${w.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Deleted');
    router.refresh();
  }

  async function test(w: WebhookType) {
    const res = await fetch(`/api/webhooks/${w.id}/test`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Test sent');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {webhooks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No webhooks configured.</Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Webhook className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{w.name}</h3>
                    <Badge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? 'Active' : 'Disabled'}</Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-500 truncate">{w.url}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.events.map((e) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => test(w)}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(w)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <Card>
          <div className="border-b px-4 py-2 text-sm font-semibold">Recent deliveries</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Webhook</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Response</th>
                <th className="px-3 py-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(d.createdAt)}</td>
                  <td className="px-3 py-2">{d.webhookName}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{d.event}</Badge></td>
                  <td className="px-3 py-2">
                    {d.status === 'SUCCESS' ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle className="h-3 w-3" /> Success</span> :
                     d.status === 'FAILED' ? <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="h-3 w-3" /> Failed</span> :
                     <span className="text-xs">{d.status}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{d.response || '—'}</td>
                  <td className="px-3 py-2 text-right text-xs">{d.duration ? `${d.duration}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
