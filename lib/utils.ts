import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Locales whose number grouping should follow local conventions (e.g. lakh/crore for INR)
const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  PKR: 'en-PK',
  BDT: 'en-IN',
  NPR: 'en-IN',
  LKR: 'en-IN',
};

export function currencyLocale(currency = 'USD') {
  return CURRENCY_LOCALES[String(currency || '').toUpperCase()] || 'en-US';
}

export function formatCurrency(amount: number | string, currency = 'USD') {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  const safe = Number.isFinite(n) ? n : 0;
  const cur = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(currencyLocale(cur), { style: 'currency', currency: cur }).format(safe);
  } catch {
    return `${cur} ${safe.toFixed(2)}`;
  }
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function nightsBetween(arrival: Date | string, departure: Date | string) {
  const a = new Date(arrival);
  const d = new Date(departure);
  return Math.max(0, Math.round((d.getTime() - a.getTime()) / 86400000));
}

export function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function generateCode(prefix = '', length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${s}` : s;
}

export function getInitials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INVITED: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  VACANT_CLEAN: 'bg-emerald-100 text-emerald-700',
  VACANT_DIRTY: 'bg-amber-100 text-amber-700',
  OCCUPIED_CLEAN: 'bg-blue-100 text-blue-700',
  OCCUPIED_DIRTY: 'bg-orange-100 text-orange-700',
  INSPECTION: 'bg-purple-100 text-purple-700',
  OUT_OF_ORDER: 'bg-red-100 text-red-700',
  OUT_OF_SERVICE: 'bg-slate-200 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-slate-100 text-slate-700',
  CANCELED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-100 text-red-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  REFUNDED: 'bg-slate-100 text-slate-700',
  FAILED: 'bg-red-100 text-red-700',
  SENT: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-slate-100 text-slate-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-slate-200 text-slate-700',
  OPEN: 'bg-amber-100 text-amber-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  AWAITING_PARTS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  INSPECTED: 'bg-emerald-100 text-emerald-700',
};

export function statusLabel(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
