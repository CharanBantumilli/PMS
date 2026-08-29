'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SeasonalRateDialog } from './seasonal-rate-dialog';

type SeasonalRate = { id: string; name: string; ratePlanId: string; ratePlanName: string; propertyName: string | null; startDate: string; endDate: string; price: number; currency: string; priority: number; isActive: boolean };

export function SeasonalRatesTable({ rates, ratePlans, properties }: { rates: SeasonalRate[]; ratePlans: { id: string; name: string }[]; properties: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SeasonalRate | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  async function onDelete(r: SeasonalRate) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    const res = await fetch(`/api/seasonal-rates/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Deleted');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Add seasonal rate</Button>
      </div>
      {rates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No seasonal rates configured. Add one to adjust pricing for holidays, peak season, or events.</Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Rate plan</th>
                <th className="px-3 py-3">Property</th>
                <th className="px-3 py-3">Period</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ratePlanName}</td>
                  <td className="px-3 py-2 text-slate-500">{r.propertyName || 'All'}</td>
                  <td className="px-3 py-2 text-slate-600"><Calendar className="inline h-3 w-3" /> {formatDate(r.startDate)} → {formatDate(r.endDate)}</td>
                  <td className="px-3 py-2 font-medium">{formatCurrency(r.price, r.currency)}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.priority}</Badge></td>
                  <td className="px-3 py-2"><Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(r)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {newOpen && <SeasonalRateDialog mode="create" ratePlans={ratePlans} properties={properties} onClose={() => setNewOpen(false)} />}
      {editing && <SeasonalRateDialog mode="edit" initial={editing} ratePlans={ratePlans} properties={properties} onClose={() => setEditing(null)} />}
    </div>
  );
}
