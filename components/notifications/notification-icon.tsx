'use client';

import {
  Bell, CalendarPlus, CalendarX, LogIn, LogOut, Banknote, CreditCard,
  AlertTriangle, FileText, Clock, Sparkles, Wrench, UserPlus, Mail,
  Globe, Link2, BellRing, TrendingDown, Settings, type LucideIcon,
} from 'lucide-react';

type IconConfig = { Icon: LucideIcon; className: string };

const NOTIFICATION_ICONS: Record<string, IconConfig> = {
  BOOKING_NEW: { Icon: CalendarPlus, className: 'bg-blue-100 text-blue-700' },
  BOOKING_CANCELLED: { Icon: CalendarX, className: 'bg-red-100 text-red-700' },
  CHECK_IN: { Icon: LogIn, className: 'bg-emerald-100 text-emerald-700' },
  CHECK_OUT: { Icon: LogOut, className: 'bg-slate-100 text-slate-700' },
  PAYMENT_RECEIVED: { Icon: Banknote, className: 'bg-emerald-100 text-emerald-700' },
  PAYMENT_FAILED: { Icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  INVOICE_SENT: { Icon: FileText, className: 'bg-blue-100 text-blue-700' },
  INVOICE_OVERDUE: { Icon: Clock, className: 'bg-amber-100 text-amber-700' },
  HOUSEKEEPING_ASSIGNED: { Icon: Sparkles, className: 'bg-purple-100 text-purple-700' },
  HOUSEKEEPING_COMPLETED: { Icon: Sparkles, className: 'bg-emerald-100 text-emerald-700' },
  MAINTENANCE_NEW: { Icon: Wrench, className: 'bg-orange-100 text-orange-700' },
  MAINTENANCE_URGENT: { Icon: Wrench, className: 'bg-red-100 text-red-700' },
  GUEST_NEW: { Icon: UserPlus, className: 'bg-blue-100 text-blue-700' },
  STAFF_INVITED: { Icon: Mail, className: 'bg-blue-100 text-blue-700' },
  CHANNEL_ERROR: { Icon: Globe, className: 'bg-red-100 text-red-700' },
  WEBHOOK_FAILED: { Icon: Link2, className: 'bg-red-100 text-red-700' },
  PAYMENT_METHOD_FAILED: { Icon: CreditCard, className: 'bg-red-100 text-red-700' },
  SUBSCRIPTION_EXPIRING: { Icon: BellRing, className: 'bg-amber-100 text-amber-700' },
  LOW_OCCUPANCY: { Icon: TrendingDown, className: 'bg-amber-100 text-amber-700' },
  SYSTEM: { Icon: Settings, className: 'bg-slate-100 text-slate-700' },
};

export function NotificationIcon({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = NOTIFICATION_ICONS[type] || { Icon: Bell, className: 'bg-slate-100 text-slate-700' };
  const box = size === 'lg' ? 'h-10 w-10 rounded-lg p-2.5' : 'h-7 w-7 rounded-md p-1.5';
  return (
    <div className={`flex shrink-0 items-center justify-center ${box} ${cfg.className}`}>
      <cfg.Icon className="h-full w-full" />
    </div>
  );
}
