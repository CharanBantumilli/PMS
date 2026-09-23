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

function MonthGrid({ year, month, startDate, endDate, hoverDate, onDayClick, onDayHover, minDate }: {
  year: number; month: number; startDate: string | null; endDate: string | null; hoverDate: string | null;
  onDayClick: (date: string) => void; onDayHover: (date: string) => void; minDate?: string;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const cells = useMemo(() => {
    const result: { day: number; date: string; currentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      result.push({ day: d, date: toDateString(y, m, d), currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, date: toDateString(year, month, d), currentMonth: true });
    }
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      result.push({ day: d, date: toDateString(y, m, d), currentMonth: false });
    }
    return result;
  }, [year, month, firstDay, daysInMonth, daysInPrevMonth]);

  const effectiveEnd = startDate && !endDate && hoverDate && isBefore(startDate, hoverDate) ? hoverDate : endDate;

  return (
    <div className="w-full">
      <div className="grid grid-cols-7">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-medium text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const isStart = startDate && isSameDay(cell.date, startDate);
          const isEnd = effectiveEnd && isSameDay(cell.date, effectiveEnd);
          const inRange = startDate && effectiveEnd && isBefore(startDate, cell.date) && isBefore(cell.date, effectiveEnd);
          const isDisabled = minDate && cell.currentMonth && isBefore(cell.date, minDate);

          return (
            <button
              key={cell.date}
              type="button"
              disabled={isDisabled}
              onMouseEnter={() => cell.currentMonth && onDayHover(cell.date)}
              onClick={() => cell.currentMonth && !isDisabled && onDayClick(cell.date)}
              className={cn(
                'flex items-center justify-center h-9 text-[13px] transition-colors rounded-full',
                !cell.currentMonth && 'text-slate-600',
                cell.currentMonth && !isStart && !isEnd && !inRange && 'text-slate-200 hover:bg-slate-800',
                isDisabled && 'cursor-not-allowed text-slate-600',
                (isStart || isEnd) && 'z-10 font-semibold text-slate-900 bg-white',
                inRange && !isStart && !isEnd && 'bg-slate-800 text-slate-300',
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

export function DateRangePicker({ startDate, endDate, onRangeChange, minDate }: {
  startDate: string | null; endDate: string | null;
  onRangeChange: (start: string | null, end: string | null) => void;
  minDate?: string;
}) {
  const today = new Date();
  const [baseMonth, setBaseMonth] = useState(today.getMonth());
  const [baseYear, setBaseYear] = useState(today.getFullYear());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<'start' | 'end'>(startDate ? 'end' : 'start');

  const leftMonth = baseMonth === 0 ? 11 : baseMonth - 1;
  const leftYear = baseMonth === 0 ? baseYear - 1 : baseYear;
  const rightMonth = baseMonth;
  const rightYear = baseYear;

  function prev() {
    setBaseMonth((m) => m === 0 ? 11 : m - 1);
    setBaseYear((y) => baseMonth === 0 ? y - 1 : y);
  }
  function next() {
    setBaseMonth((m) => m === 11 ? 0 : m + 1);
    setBaseYear((y) => baseMonth === 11 ? y + 1 : y);
  }

  function handleDayClick(date: string) {
    if (selecting === 'start') {
      onRangeChange(date, null);
      setSelecting('end');
    } else {
      if (startDate && isBefore(date, startDate)) {
        onRangeChange(date, startDate);
      } else {
        onRangeChange(startDate, date);
      }
      setSelecting('start');
    }
  }

  function handleDayHover(date: string) {
    if (selecting === 'end') {
      setHoverDate(date);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200 w-full max-w-[520px] shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={prev} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-10">
          <span className="text-sm font-semibold text-slate-100">{MONTH_NAMES[leftMonth]} {leftYear}</span>
          <span className="text-sm font-semibold text-slate-100">{MONTH_NAMES[rightMonth]} {rightYear}</span>
        </div>
        <button type="button" onClick={next} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <MonthGrid year={leftYear} month={leftMonth} startDate={startDate} endDate={endDate} hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={handleDayHover} minDate={minDate} />
        <MonthGrid year={rightYear} month={rightMonth} startDate={startDate} endDate={endDate} hoverDate={hoverDate} onDayClick={handleDayClick} onDayHover={handleDayHover} minDate={minDate} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-3 text-xs text-slate-400">
        <span>{startDate || 'Start date'}</span>
        <span>→</span>
        <span>{endDate || 'End date'}</span>
      </div>
    </div>
  );
}
