'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isBefore(a: string, b: string) {
  return a < b;
}

function isSameDay(a: string, b: string) {
  return a === b;
}

export function SingleMonthCalendar({ selected, onSelect, minDate }: {
  selected: string | null;
  onSelect: (date: string) => void;
  minDate?: string;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1);

  const cells = useMemo(() => {
    const result: { day: number; date: string; currentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      result.push({ day: d, date: toDateString(y, m, d), currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, date: toDateString(viewYear, viewMonth, d), currentMonth: true });
    }
    const remaining = 35 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      result.push({ day: d, date: toDateString(y, m, d), currentMonth: false });
    }
    return result;
  }, [viewYear, viewMonth, firstDay, daysInMonth, daysInPrevMonth]);

  function prev() {
    setViewMonth((m) => m === 0 ? 11 : m - 1);
    setViewYear((y) => viewMonth === 0 ? y - 1 : y);
  }
  function next() {
    setViewMonth((m) => m === 11 ? 0 : m + 1);
    setViewYear((y) => viewMonth === 11 ? y + 1 : y);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prev} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-900">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={next} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const isSelected = selected && isSameDay(cell.date, selected);
          const isDisabled = minDate && cell.currentMonth && isBefore(cell.date, minDate);
          const isToday = isSameDay(cell.date, today.toISOString().slice(0, 10));

          return (
            <button
              key={cell.date}
              type="button"
              disabled={isDisabled}
              onClick={() => cell.currentMonth && !isDisabled && onSelect(cell.date)}
              className={cn(
                'flex items-center justify-center h-8 text-[13px] rounded-full transition-colors',
                !cell.currentMonth && 'text-slate-300',
                cell.currentMonth && !isSelected && !isDisabled && 'text-slate-700 hover:bg-slate-100',
                isDisabled && 'cursor-not-allowed text-slate-300',
                isSelected && 'bg-slate-900 font-semibold text-white',
                !isSelected && isToday && cell.currentMonth && 'font-semibold text-slate-900 ring-1 ring-slate-900',
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
