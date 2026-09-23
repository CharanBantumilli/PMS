'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STATUS_COLORS, statusLabel } from '@/lib/utils';
import { SelectHTML } from '@/components/ui/select-native';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Unit = { id: string; number: string; name: string; propertyId: string };
type Booking = { id: string; unitId: string | null; guest: string; arrivalDate: string; departureDate: string; status: string; confirmationCode: string };

export function CalendarView({ from, days, units, bookings, properties, activePropertyId }: { from: string; days: string[]; units: Unit[]; bookings: Booking[]; properties: { id: string; name: string }[]; activePropertyId?: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  function prev() {
    const d = new Date(from);
    d.setDate(d.getDate() - 14);
    router.push(`/dashboard/reservations/calendar?from=${d.toISOString()}`);
  }
  function next() {
    const d = new Date(from);
    d.setDate(d.getDate() + 14);
    router.push(`/dashboard/reservations/calendar?from=${d.toISOString()}`);
  }
  function setProperty(pid: string) {
    router.push(`/dashboard/reservations/calendar?propertyId=${pid}&from=${from}`);
  }

  const unitCol = 100;
  const dayCol = 64;
  const minWidth = unitCol + days.length * dayCol;

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
        <div className="flex items-center gap-1">
          <button onClick={prev} className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
          <button onClick={next} className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50">Next <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <span className="text-sm text-slate-600">{days[0]} → {days[days.length - 1]}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <div style={{ minWidth }} className="grid">
          <div className="sticky top-0 z-10 grid bg-slate-50 text-xs" style={{ gridTemplateColumns: `${unitCol}px repeat(${days.length}, ${dayCol}px)` }}>
            <div className="border-b border-r p-2 font-semibold text-slate-700">Unit</div>
            {days.map((d) => {
              const dt = new Date(d);
              const isToday = d === today;
              return (
                <div key={d} className={`border-b border-r p-2 text-center text-[10px] font-medium ${isToday ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>
                  <div>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  <div className="text-[11px] font-semibold">{dt.getDate()} {dt.toLocaleDateString('en-IN', { month: 'short' })}</div>
                </div>
              );
            })}
          </div>
          {units.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No units for this property.</div>
          ) : units.map((u) => (
            <div key={u.id} className="grid hover:bg-slate-50" style={{ gridTemplateColumns: `${unitCol}px repeat(${days.length}, ${dayCol}px)` }}>
              <div className="border-b border-r p-2 text-xs font-medium text-slate-700">#{u.number}</div>
              {days.map((d) => {
                const b = bookingForCell(u.id, d);
                const isToday = d === today;
                return (
                  <div key={d} className={`border-b border-r p-0.5 ${isToday ? 'bg-blue-50/50' : ''}`} style={{ minHeight: 36 }}>
                    {b ? (
                      <Link href={`/dashboard/reservations/bookings/${b.id}`} title={`${b.guest} · ${b.confirmationCode}`} className={`block h-full w-full rounded text-[9px] font-medium ${STATUS_COLORS[b.status]} p-1 truncate`}>{b.guest}</Link>
                    ) : (
                      <Link href={`/dashboard/reservations/bookings/new?propertyId=${activePropertyId || ''}&arrivalDate=${d}`} title="Create booking" className="block h-full w-full rounded p-1 text-center text-[9px] text-slate-300 hover:bg-slate-100 hover:text-slate-500">+</Link>
                    )}
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
