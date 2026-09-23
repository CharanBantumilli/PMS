'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { SingleMonthCalendar } from './single-month-calendar';

export function DateInput({ name, required, defaultValue, minDate, placeholder }: {
  name: string;
  required?: boolean;
  defaultValue?: string;
  minDate?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue || '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} required={required} />
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <span className={value ? '' : 'text-slate-400'}>{value || placeholder || 'Pick a date'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1">
          <SingleMonthCalendar
            selected={value || null}
            onSelect={(d) => { setValue(d); setOpen(false); }}
            minDate={minDate}
          />
        </div>
      )}
    </div>
  );
}
