'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar, Lock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { RestrictionDialog } from './restriction-dialog';

type Restriction = { id: string; restrictionType: string; startDate: string; endDate: string; minLOS: number | null; maxLOS: number | null; closedToArrival: boolean; closedToDeparture: boolean; minAdvance: number | null; maxAdvance: number | null; isActive: boolean };

export function RestrictionsTable({ restrictions }: { restrictions: Restriction[] }) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);

  async function onDelete(r: Restriction) {
    if (!confirm('Delete this restriction?')) return;
    const res = await fetch(`/api/rate-restrictions/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Deleted');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Add restriction</Button>
      </div>
      {restrictions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No restrictions configured. Add minimum stay, closed-to-arrival/departure, or advance booking rules.</Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Period</th>
                <th className="px-3 py-3">Rules</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {restrictions.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.restrictionType.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-slate-600"><Calendar className="inline h-3 w-3" /> {formatDate(r.startDate)} → {formatDate(r.endDate)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.minLOS && <Badge variant="outline" className="mr-1">Min LOS {r.minLOS}</Badge>}
                    {r.maxLOS && <Badge variant="outline" className="mr-1">Max LOS {r.maxLOS}</Badge>}
                    {r.closedToArrival && <Badge variant="warning" className="mr-1">No arrival</Badge>}
                    {r.closedToDeparture && <Badge variant="warning" className="mr-1">No departure</Badge>}
                    {r.minAdvance && <Badge variant="outline" className="mr-1">Min {r.minAdvance}d advance</Badge>}
                  </td>
                  <td className="px-3 py-2"><Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {newOpen && <RestrictionDialog mode="create" onClose={() => setNewOpen(false)} />}
    </div>
  );
}
