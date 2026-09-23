'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { STATUS_COLORS, statusLabel } from '@/lib/utils';
import { Filter, Wrench, Sparkles, Radio, CalendarPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { useRealtimeEvents } from '@/lib/use-realtime';
import toast from 'react-hot-toast';
import { SelectHTML } from '@/components/ui/select-native';
import { UnitDialog } from './unit-dialog';

type Unit = {
  id: string; number: string; name: string; status: string; floor?: string | null; notes?: string | null;
  propertyId: string; propertyName: string;
  unitType: { id: string; name: string } | null;
};

const COLUMNS = [
  { key: 'VACANT_CLEAN', title: 'Vacant clean', color: 'border-emerald-300' },
  { key: 'VACANT_DIRTY', title: 'Vacant dirty', color: 'border-amber-300' },
  { key: 'OCCUPIED_CLEAN', title: 'Occupied clean', color: 'border-blue-300' },
  { key: 'OCCUPIED_DIRTY', title: 'Occupied dirty', color: 'border-orange-300' },
  { key: 'INSPECTION', title: 'Inspection', color: 'border-purple-300' },
  { key: 'OUT_OF_ORDER', title: 'Out of order', color: 'border-red-300' },
  { key: 'OUT_OF_SERVICE', title: 'Out of service', color: 'border-slate-300' },
];

export function UnitsBoard({
  units, properties, unitTypes, activePropertyId, plan = 'STARTER', currency = 'USD',
}: {
  units: Unit[];
  properties: { id: string; name: string }[];
  unitTypes: { id: string; name: string }[];
  activePropertyId?: string;
  plan?: string;
  currency?: string;
}) {
  const router = useRouter();
  const [liveUpdates, setLiveUpdates] = useState(0);
  const { connected } = useRealtimeEvents({
    onUnitStatusChanged: () => { setLiveUpdates((n) => n + 1); router.refresh(); },
    onBookingCreated: () => router.refresh(),
  });
  const isStarter = plan === 'STARTER';
  const [filter, setFilter] = useState<string>(activePropertyId || (isStarter && properties.length > 0 ? properties[0].id : 'all'));
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [collapsedProperties, setCollapsedProperties] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isStarter && filter === 'all' && properties.length > 0) {
      setFilter(properties[0].id);
    }
  }, [isStarter, filter, properties]);

  const filtered = useMemo(() => filter === 'all' ? units : units.filter((u) => u.propertyId === filter), [units, filter]);

  const grouped = useMemo(() => {
    const m: Record<string, Unit[]> = {};
    COLUMNS.forEach((c) => (m[c.key] = []));
    filtered.forEach((u) => { (m[u.status] ||= []).push(u); });
    return m;
  }, [filtered]);

  const groupedByProperty = useMemo(() => {
    if (isStarter || filter !== 'all') return null;
    const props = new Map<string, { name: string; units: Unit[] }>();
    filtered.forEach((u) => {
      if (!props.has(u.propertyId)) props.set(u.propertyId, { name: u.propertyName, units: [] });
      props.get(u.propertyId)!.units.push(u);
    });
    return Array.from(props.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      grouped: (() => {
        const m: Record<string, Unit[]> = {};
        COLUMNS.forEach((c) => (m[c.key] = []));
        data.units.forEach((u) => { (m[u.status] ||= []).push(u); });
        return m;
      })(),
      total: data.units.length,
    }));
  }, [filtered, isStarter, filter]);

  function toggleProperty(id: string) {
    setCollapsedProperties((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/units/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error('Could not update'); return; }
    toast.success('Status updated');
    router.refresh();
  }

  function renderKanban(grouped: Record<string, Unit[]>, compact = false) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const list = grouped[col.key] || [];
          return (
            <div key={col.key} className={`w-64 shrink-0 rounded-lg border bg-white ${col.color} border-t-4`}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2">
                <div className="text-sm font-semibold text-slate-800">{col.title}</div>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="space-y-2 p-2 min-h-[100px]">
                {list.length === 0 && <div className="py-4 text-center text-xs text-slate-400">No units</div>}
                {list.map((u) => (
                  <Card key={u.id} className="cursor-pointer p-3 hover:shadow-md" onClick={() => setEditingUnit(u)}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">#{u.number}</div>
                      <Badge className={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{u.name}</div>
                    {!compact && u.unitType && (
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{u.unitType.name}</span>
                      </div>
                    )}
                    {!compact && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                        {u.floor && <span>Floor {u.floor}</span>}
                      </div>
                    )}
                    <div className="mt-2 flex gap-1">
                      {u.status === 'VACANT_CLEAN' && (
                        <Link href={`/dashboard/reservations/bookings/new?propertyId=${u.propertyId}&unitId=${u.id}`} onClick={(e) => e.stopPropagation()} className="flex-1 rounded border border-emerald-200 bg-emerald-50 px-1 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 text-center" title="Book this room">
                          <CalendarPlus className="mx-auto h-3 w-3" />
                        </Link>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/operations/housekeeping?unitId=${u.id}`); }} className="flex-1 rounded border bg-white px-1 py-1 text-[10px] hover:bg-slate-50">
                        <Sparkles className="mx-auto h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/operations/maintenance?unitId=${u.id}`); }} className="flex-1 rounded border bg-white px-1 py-1 text-[10px] hover:bg-slate-50">
                        <Wrench className="mx-auto h-3 w-3" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <SelectHTML value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 border-0 px-0 focus:ring-0">
            {!isStarter && <option value="all">All properties</option>}
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectHTML>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 text-xs text-slate-500">
          <Radio className={`h-3 w-3 ${connected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          {connected ? 'Live' : 'Offline'} {liveUpdates > 0 && `· ${liveUpdates} update${liveUpdates > 1 ? 's' : ''}`}
        </div>
      </div>

      {!isStarter && filter === 'all' && groupedByProperty ? (
        groupedByProperty.map((prop) => {
          const isCollapsed = collapsedProperties.has(prop.id);
          return (
            <div key={prop.id} className="rounded-lg border bg-white">
              <button
                onClick={() => toggleProperty(prop.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                <span className="font-semibold text-slate-900">{prop.name}</span>
                <Badge variant="secondary" className="ml-1">{prop.total}</Badge>
              </button>
              {!isCollapsed && (
                <div className="border-t p-3">
                  {renderKanban(prop.grouped, true)}
                </div>
              )}
            </div>
          );
        })
      ) : (
        renderKanban(grouped)
      )}

      {editingUnit && (
        <UnitDialog
          mode="edit"
          unit={editingUnit}
          properties={properties}
          unitTypes={unitTypes}
          defaultPropertyId={editingUnit.propertyId}
          onClose={() => setEditingUnit(null)}
          onStatusChange={(s) => { changeStatus(editingUnit.id, s); setEditingUnit(null); }}
        />
      )}
    </div>
  );
}
