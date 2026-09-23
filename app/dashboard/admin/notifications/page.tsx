import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { NotificationsList } from '@/components/notifications/notifications-list';
import { NotificationActions } from '@/components/notifications/notification-actions';

export default async function NotificationsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const userId = session!.user.id;

  const where: any = {
    organizationId: orgId,
    userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
  if (searchParams.filter === 'unread') where.isRead = false;

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.notification.count({ where: { organizationId: orgId, userId } }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600">{unreadCount} unread of {totalCount} total</p>
        </div>
        {notifications.length > 0 && <NotificationActions hasUnread={unreadCount > 0} />}
      </div>
      <div className="flex items-center gap-2">
        <a href="/dashboard/admin/notifications" className={`rounded-full border px-3 py-1 text-xs font-medium ${!searchParams.filter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>All</a>
        <a href="/dashboard/admin/notifications?filter=unread" className={`rounded-full border px-3 py-1 text-xs font-medium ${searchParams.filter === 'unread' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Unread ({unreadCount})</a>
      </div>
      {notifications.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Bell className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No notifications</h2>
          <p className="mt-1 text-sm text-slate-600">You're all caught up!</p>
        </CardContent></Card>
      ) : (
        <NotificationsList
          notifications={notifications.map((n) => ({
            id: n.id, type: n.type, priority: n.priority,
            title: n.title, message: n.message, entity: n.entity,
            entityId: n.entityId, actionUrl: n.actionUrl,
            isRead: n.isRead, createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
