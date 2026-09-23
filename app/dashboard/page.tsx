import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/dashboard/stats-card';
import { formatCurrency, formatDate, statusLabel, STATUS_COLORS } from '@/lib/utils';
import { BedDouble, Calendar, Users, DollarSign, TrendingUp, AlertCircle, Inbox, Sparkles, Wrench } from 'lucide-react';
import Link from 'next/link';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { DashboardLive } from '@/components/dashboard/dashboard-live';

export default async function DashboardPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  // Money figures and booking amounts stay management-only
  const canSeeMoney = ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(session!.user.role || '');
  const today = new Date();
  const startToday = startOfDay(today);
  const endToday = endOfDay(today);
  const last30 = subDays(today, 30);
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
  const currency = org?.currency || 'INR';

  const [
    propertyCount,
    unitCount,
    guestCount,
    arrivalsToday,
    departuresToday,
    inHouse,
    pendingBookings,
    openTasks,
    openTickets,
    revenueAgg,
    recentBookings,
    upcomingArrivals,
    unitsByStatus,
  ] = await Promise.all([
    prisma.property.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.unit.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.guest.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.booking.findMany({
      where: { organizationId: orgId, arrivalDate: { gte: startToday, lte: endToday }, status: { in: ['CONFIRMED','PENDING','CHECKED_IN'] } },
      include: { guest: true, unit: true, property: true },
      orderBy: { arrivalDate: 'asc' },
    }),
    prisma.booking.findMany({
      where: { organizationId: orgId, departureDate: { gte: startToday, lte: endToday }, status: 'CHECKED_IN' },
      include: { guest: true, unit: true, property: true },
      orderBy: { departureDate: 'asc' },
    }),
    prisma.booking.count({ where: { organizationId: orgId, status: 'CHECKED_IN' } }),
    prisma.booking.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    prisma.housekeepingTask.count({ where: { organizationId: orgId, status: { in: ['PENDING','IN_PROGRESS'] } } }),
    prisma.maintenanceTicket.count({ where: { organizationId: orgId, status: { in: ['OPEN','ASSIGNED','IN_PROGRESS'] } } }),
    prisma.payment.aggregate({ where: { organizationId: orgId, status: 'PAID', paidAt: { gte: last30 } }, _sum: { amount: true } }),
    prisma.booking.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { guest: true, unit: true, property: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { organizationId: orgId, arrivalDate: { gte: startToday }, status: { in: ['CONFIRMED','PENDING'] } },
      include: { guest: true, unit: true, property: true },
      orderBy: { arrivalDate: 'asc' },
      take: 8,
    }),
    prisma.unit.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
  ]);

  const occupancy = unitCount > 0 ? Math.round((inHouse / unitCount) * 100) : 0;
  const revenue30 = Number(revenueAgg._sum.amount || 0);

  return (
    <div className="space-y-6">
      <DashboardLive />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <StatsCard label="Properties" value={propertyCount} icon={BedDouble} />
        <StatsCard label="Units" value={unitCount} icon={BedDouble} />
        {canSeeMoney && <StatsCard label="Guests" value={guestCount} icon={Users} />}
        <StatsCard label="Occupancy" value={`${occupancy}%`} icon={TrendingUp} sub={`${inHouse} in-house`} />
        {canSeeMoney && <StatsCard label="Revenue (30d)" value={formatCurrency(revenue30, currency)} icon={DollarSign} sub="Paid" />}
        <StatsCard label="Arrivals today" value={arrivalsToday.length} icon={Calendar} />
        <StatsCard label="Departures today" value={departuresToday.length} icon={Calendar} />
        {canSeeMoney && <StatsCard label="Pending bookings" value={pendingBookings} icon={AlertCircle} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming arrivals</CardTitle>
              <CardDescription>Guests arriving in the next days</CardDescription>
            </div>
            <Link href="/dashboard/reservations/bookings" className="text-sm font-medium text-slate-700 hover:text-slate-900">View all</Link>
          </CardHeader>
          <CardContent>
            {upcomingArrivals.length === 0 ? (
              <EmptyState label="No upcoming arrivals" />
            ) : (
              <div className="divide-y">
                {upcomingArrivals.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-900">{b.guest.firstName} {b.guest.lastName}</div>
                      <div className="text-xs text-slate-500">{b.property.name} {b.unit ? `· ${b.unit.name}` : ''} · {b.nights}n</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900">{formatDate(b.arrivalDate)}</div>
                      <Badge className={STATUS_COLORS[b.status]}>{statusLabel(b.status)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
            <CardDescription>Live operational queue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/operations/housekeeping" className="flex items-center justify-between rounded-md border p-3 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Housekeeping tasks</span>
              </div>
              <Badge variant="warning">{openTasks}</Badge>
            </Link>
            <Link href="/dashboard/operations/maintenance" className="flex items-center justify-between rounded-md border p-3 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <Wrench className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Open maintenance</span>
              </div>
              <Badge variant="destructive">{openTickets}</Badge>
            </Link>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Unit status</div>
              <div className="space-y-1.5">
                {unitsByStatus.map((u) => (
                  <div key={u.status} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{statusLabel(u.status)}</span>
                    <span className="font-medium">{u._count._all}</span>
                  </div>
                ))}
                {unitsByStatus.length === 0 && <div className="text-sm text-slate-500">No units yet</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {canSeeMoney && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent bookings</CardTitle>
            <CardDescription>Latest reservations across all properties</CardDescription>
          </div>
          <Link href="/dashboard/reservations/bookings" className="text-sm font-medium text-slate-700 hover:text-slate-900">View all</Link>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <EmptyState label="No bookings yet. Create your first reservation." action={{ label: 'New booking', href: '/dashboard/reservations/bookings/new' }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Guest</th>
                    <th className="px-3 py-2.5">Property / Unit</th>
                    <th className="px-3 py-2.5">Stay</th>
                    <th className="px-3 py-2.5">Total</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-900">{b.guest.firstName} {b.guest.lastName}</td>
                      <td className="px-3 py-2.5 text-slate-600">{b.property.name} {b.unit ? `· ${b.unit.name}` : ''}</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDate(b.arrivalDate)} → {formatDate(b.departureDate)} ({b.nights}n)</td>
                      <td className="px-3 py-2.5 font-medium">{formatCurrency(Number(b.totalAmount), b.currency)}</td>
                      <td className="px-3 py-2.5"><Badge className={STATUS_COLORS[b.status]}>{statusLabel(b.status)}</Badge></td>
                      <td className="px-3 py-2.5 text-slate-600">{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function EmptyState({ label, action }: { label: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <div className="mt-3 text-sm text-slate-600">{label}</div>
      {action && (
        <Link href={action.href} className="mt-3 text-sm font-medium text-slate-900 hover:underline">{action.label} →</Link>
      )}
    </div>
  );
}
