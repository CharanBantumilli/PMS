'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2, MapPin, Building2, Star } from 'lucide-react';
import toast from 'react-hot-toast';

type Property = {
  id: string;
  name: string;
  code: string;
  type: string;
  city: string | null;
  country: string | null;
  starRating: number | null;
  isActive: boolean;
  unitCount: number;
  address: string;
};

const TYPE_LABELS: Record<string, string> = {
  HOTEL: 'Hotel', HOSTEL: 'Hostel', APARTMENT: 'Apartment', VILLA: 'Villa',
  RESORT: 'Resort', BED_BREAKFAST: 'B&B', VACATION_RENTAL: 'Vacation rental', BOUTIQUE: 'Boutique',
};

export function PropertiesTable({ properties }: { properties: Property[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all units and bookings. This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) { toast.error('Could not delete property'); return; }
    toast.success('Property deleted');
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Units</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {properties.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <Link href={`/dashboard/properties/${p.id}`} className="font-medium text-slate-900 hover:underline">{p.name}</Link>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span>{p.code}</span>
                      {p.starRating ? (
                        <span className="ml-1 flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: p.starRating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{TYPE_LABELS[p.type] || p.type}</td>
              <td className="px-4 py-3 text-slate-600">
                {p.address ? (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.address}</span>
                ) : '—'}
              </td>
              <td className="px-4 py-3 font-medium">{p.unitCount}</td>
              <td className="px-4 py-3">
                <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/properties/${p.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                  <Button variant="ghost" size="icon" disabled={busyId === p.id} onClick={() => onDelete(p.id, p.name)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
