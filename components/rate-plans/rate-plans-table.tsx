'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, statusLabel } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { RatePlanDialog } from './rate-plan-dialog';

type Plan = { id: string; name: string; description: string | null; basePrice: number; isRefundable: boolean; minStay: number; maxStay: number | null; mealsIncluded: string; isActive: boolean; property: { name: string } | null; bookingCount: number };

const MEALS: Record<string, string> = { none: 'No meals', breakfast: 'Breakfast', 'half-board': 'Half board', 'full-board': 'Full board', 'all-inclusive': 'All inclusive' };

export function RatePlansTable({ plans, properties, currency = 'USD' }: { plans: Plan[]; properties: { id: string; name: string }[]; currency?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Plan | null>(null);
  async function onDelete(p: Plan) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const res = await fetch(`/api/rate-plans/${p.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Deleted');
    router.refresh();
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <div className="text-xs text-slate-500">{p.property?.name || 'All properties'}</div>
                {p.description && <p className="mt-1 text-xs text-slate-600">{p.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(p)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold">{formatCurrency(p.basePrice, currency)}<span className="text-sm font-normal text-slate-500"> /night</span></div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
              <Badge variant="outline">Stay {p.minStay}-{p.maxStay || '∞'}</Badge>
              <Badge variant="outline">{p.isRefundable ? 'Refundable' : 'Non-refundable'}</Badge>
              <Badge variant="outline">{MEALS[p.mealsIncluded] || p.mealsIncluded}</Badge>
            </div>
            <div className="mt-3 text-xs text-slate-500">{p.bookingCount} booking{p.bookingCount !== 1 ? 's' : ''} using this plan</div>
          </Card>
        ))}
      </div>
      {editing && <RatePlanDialog mode="edit" initial={editing} properties={properties} onClose={() => setEditing(null)} />}
    </>
  );
}
