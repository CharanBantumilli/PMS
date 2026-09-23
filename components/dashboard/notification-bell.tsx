'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, CheckCheck, X } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/date-utils';
import { NotificationIcon } from '@/components/notifications/notification-icon';
import toast from 'react-hot-toast';

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

const PRIORITY_BORDER: Record<string, string> = {
  URGENT: 'border-l-4 border-l-red-500',
  HIGH: 'border-l-4 border-l-amber-500',
  NORMAL: '',
  LOW: 'opacity-75',
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/notifications/unread-count');
      if (res.ok) { const d = await res.json(); setUnreadCount(d.count); }
    } catch {}
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (res.ok) {
        const d = await res.json();
        setNotifications(d.notifications);
        setUnreadCount(d.unreadCount);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // poll every 30s
    // Also listen for real-time events
    function onRealtime() { fetchUnreadCount(); }
    window.addEventListener('realtime-notification', onRealtime);
    // Connect to SSE for instant updates
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('notification.new', onRealtime);
    } catch {}
    return () => {
      clearInterval(interval);
      window.removeEventListener('realtime-notification', onRealtime);
      es?.close();
    };
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markRead(id: string) {
    const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function markAllRead() {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    }
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Dismissed');
    }
  }

  function handleClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.actionUrl) { setOpen(false); router.push(n.actionUrl); }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700" title="Mark all as read">
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              <Link href="/dashboard/admin/notifications" onClick={() => setOpen(false)} className="rounded p-1 text-xs text-blue-600 hover:bg-blue-50">
                View all
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">We'll notify you when something important happens</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`group relative cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 ${PRIORITY_BORDER[n.priority] || ''} ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex gap-3">
                      <NotificationIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</p>
                          {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatDistanceToNow(n.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t bg-slate-50 px-4 py-2 text-center">
              <Link href="/dashboard/admin/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-blue-600 hover:underline">
                See all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
