'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pencil, Trash2, Bed, Users, Maximize } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { UnitTypeDialog } from './unit-type-dialog';

type Type = {
  id: string; name: string; description: string | null;
  baseOccupancy: number; maxOccupancy: number;
  extraPersonFee: number | null;
  bedType: string; bedCount: number; bathroomCount: number;
  unitCount: number;
};

const BED_LABEL: Record<string, string> = {
  SINGLE: 'Single', DOUBLE: 'Double', QUEEN: 'Queen', KING: 'King', TWIN: 'Twin', BUNK: 'Bunk', SOFA_BED: 'Sofa bed', NONE: 'No bed',
};

export function UnitTypesTable({ types, currency = 'USD' }: { types: Type[]; currency?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Type | null>(null);

  async function onDelete(t: Type) {
    if (!confirm(`Delete "${t.name}"? Units using this type will be unassigned.`)) return;
    const res = await fetch(`/api/unit-types/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not delete'); return; }
    toast.success('Deleted');
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{t.extraPersonFee != null ? `${formatCurrency(t.extraPersonFee, currency)} extra/person` : ''}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.baseOccupancy}/{t.maxOccupancy}</div>
              <div className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {t.bedCount}× {BED_LABEL[t.bedType]}</div>
              <div>{t.bathroomCount} bath</div>
            </div>
            <div className="mt-3 text-xs text-slate-500">{t.unitCount} unit{t.unitCount !== 1 ? 's' : ''} assigned</div>
          </Card>
        ))}
      </div>
      {editing && <UnitTypeDialog mode="edit" initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
