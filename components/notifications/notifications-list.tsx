'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CheckCheck, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { NotificationIcon } from '@/components/notifications/notification-icon';

type Notification = {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  entity: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  BOOKING_NEW: 'New booking', BOOKING_CANCELLED: 'Booking cancelled',
  CHECK_IN: 'Check-in', CHECK_OUT: 'Check-out',
  PAYMENT_RECEIVED: 'Payment received', PAYMENT_FAILED: 'Payment failed',
  INVOICE_SENT: 'Invoice sent', INVOICE_OVERDUE: 'Invoice overdue',
  HOUSEKEEPING_ASSIGNED: 'Housekeeping assigned', HOUSEKEEPING_COMPLETED: 'Housekeeping completed',
  MAINTENANCE_NEW: 'Maintenance ticket', MAINTENANCE_URGENT: 'Urgent maintenance',
  GUEST_NEW: 'New guest', STAFF_INVITED: 'Staff invited',
  PAYMENT_METHOD_FAILED: 'Payment method failed',
  LOW_OCCUPANCY: 'Low occupancy', SYSTEM: 'System',
};

const PRIORITY_VARIANT: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  URGENT: 'destructive',
  HIGH: 'warning',
  NORMAL: 'secondary',
  LOW: 'outline',
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationsList({ notifications: initial }: { notifications: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);

  async function markRead(id: string) {
    const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    if (res.ok) setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }

  async function dismiss(id: string) {
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((n) => n.id !== id));
      router.refresh();
    }
  }

  async function markAllRead() {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (res.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
      router.refresh();
    }
  }

  async function clearAll() {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    await Promise.all(items.map((n) => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })));
    setItems([]);
    toast.success('All notifications cleared');
    router.refresh();
  }

  function handleClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck className="h-3 w-3" /> Mark all read</Button>
          <Button size="sm" variant="ghost" onClick={clearAll}><Trash2 className="h-3 w-3" /> Clear all</Button>
        </div>
      )}
      <div className="space-y-2">
        {items.map((n) => (
          <Card
            key={n.id}
            className={`p-4 transition-colors ${n.actionUrl ? 'cursor-pointer hover:bg-slate-50' : ''} ${!n.isRead ? 'border-l-4 border-l-blue-500' : ''} ${n.priority === 'URGENT' && !n.isRead ? 'border-l-red-500' : ''} ${n.priority === 'HIGH' && !n.isRead ? 'border-l-amber-500' : ''}`}
            onClick={() => handleClick(n)}
          >
            <div className="flex items-start gap-3">
              <NotificationIcon type={n.type} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</h3>
                    <Badge variant={PRIORITY_VARIANT[n.priority] || 'secondary'} className="text-[10px]">{n.priority}</Badge>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[n.type] || n.type}</Badge>
                  {!n.isRead && <span className="font-semibold text-blue-600">UNREAD</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.isRead && (
                  <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Mark as read">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
