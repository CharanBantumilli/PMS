'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function NotificationActions({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();

  async function markAllRead() {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (res.ok) {
      toast.success('All notifications marked as read');
      router.refresh();
    }
  }

  async function clearAll() {
    if (!confirm('Delete all read notifications? This cannot be undone.')) return;
    // Fetch and delete all read
    const res = await fetch('/api/notifications?limit=200');
    if (!res.ok) return;
    const data = await res.json();
    const readOnes = data.notifications.filter((n: any) => n.isRead);
    await Promise.all(readOnes.map((n: any) => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })));
    toast.success(`Cleared ${readOnes.length} read notification${readOnes.length !== 1 ? 's' : ''}`);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {hasUnread && (
        <Button size="sm" variant="outline" onClick={markAllRead}>
          <CheckCheck className="h-3 w-3" /> Mark all read
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={clearAll}>
        <Trash2 className="h-3 w-3" /> Clear read
      </Button>
    </div>
  );
}
