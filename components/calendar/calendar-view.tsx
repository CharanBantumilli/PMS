'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STATUS_COLORS, statusLabel } from '@/lib/utils';
import { SelectHTML } from '@/components/ui/select-native';

type Unit = { id: string; number: string; name: string; propertyId: string };
type Booking = { id: string; unitId: string | null; guest: string; arrivalDate: string; departureDate: string; status: string; confirmationCode: string };

export function CalendarView({ from, days, units, bookings, properties, activePropertyId }: { from: string; days: string[]; units: Unit[]; bookings: Booking[]; properties: { id: string; name: string }[]; activePropertyId?: string }) {
  const router = useRouter();

  function prev() {
    const d = new Date(from);
    d.setDate(d.getDate() - 14);
    router.push(`/dashboard/calendar?from=${d.toISOString()}`);
  }
  function next() {
    const d = new Date(from);
    d.setDate(d.getDate() + 14);
    router.push(`/dashboard/calendar?from=${d.toISOString()}`);
  }
  function setProperty(pid: string) {
    router.push(`/dashboard/calendar?propertyId=${pid}&from=${from}`);
  }

  const minWidth = 80 + days.length * 56;

  function bookingForCell(unitId: string, day: string) {
    return bookings.find((b) => {
      if (b.unitId !== unitId) return false;
      const a = new Date(b.arrivalDate);
      const d = new Date(b.departureDate);
      const cell = new Date(day);
      return cell >= a && cell < d;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectHTML value={activePropertyId} onChange={(e) => setProperty(e.target.value)} className="h-9 w-auto">
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectHTML>
        <button onClick={prev} className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50">← Previous</button>
        <button onClick={next} className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50">Next →</button>
        <span className="text-sm text-slate-600">Showing {days[0]} → {days[days.length - 1]}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <div style={{ minWidth }} className="grid" >
          <div className="sticky top-0 z-10 grid bg-slate-50 text-xs" style={{ gridTemplateColumns: `80px repeat(${days.length}, 56px)` }}>
            <div className="border-b border-r p-2 font-semibold">Unit</div>
            {days.map((d) => (
              <div key={d} className="border-b border-r p-2 text-center text-[10px] font-medium text-slate-600">
                {new Date(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>
          {units.map((u) => (
            <div key={u.id} className="grid hover:bg-slate-50" style={{ gridTemplateColumns: `80px repeat(${days.length}, 56px)` }}>
              <div className="border-b border-r p-2 text-xs font-medium text-slate-700">#{u.number}</div>
              {days.map((d) => {
                const b = bookingForCell(u.id, d);
                return (
                  <div key={d} className="border-b border-r p-0.5" style={{ minHeight: 32 }}>
                    {b && <Link href={`/dashboard/bookings/${b.id}`} title={`${b.guest} · ${b.confirmationCode}`} className={`block h-full w-full rounded text-[9px] font-medium ${STATUS_COLORS[b.status]} p-1 truncate`}>{b.guest}</Link>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
