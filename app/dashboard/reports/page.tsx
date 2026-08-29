import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { StatsCard } from '@/components/dashboard/stats-card';
import { DollarSign, TrendingUp, Users, BedDouble, Calendar, BarChart3 } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, subDays, format } from 'date-fns';

export default async function ReportsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
  const currency = org?.currency || 'INR';
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [bookingsThisMonth, bookingsLastMonth, revenueThis, revenueLast, bySource, occupancy, adrStats, topGuests] = await Promise.all([
    prisma.booking.count({ where: { organizationId: orgId, createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.booking.count({ where: { organizationId: orgId, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.payment.aggregate({ where: { organizationId: orgId, status: 'PAID', paidAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { organizationId: orgId, status: 'PAID', paidAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
    prisma.booking.groupBy({ by: ['source'], where: { organizationId: orgId, createdAt: { gte: monthStart } }, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.booking.count({ where: { organizationId: orgId, status: 'CHECKED_IN' } }),
    prisma.booking.aggregate({ where: { organizationId: orgId, status: { in: ['CHECKED_IN','CHECKED_OUT'] }, createdAt: { gte: monthStart } }, _avg: { unitRate: true } }),
    prisma.guest.findMany({ where: { organizationId: orgId }, orderBy: { totalSpent: 'desc' }, take: 5 }),
  ]);

  const totalUnits = await prisma.unit.count({ where: { organizationId: orgId, isActive: true } });
  const occRate = totalUnits > 0 ? Math.round((occupancy / totalUnits) * 100) : 0;
  const adr = Number(adrStats._avg.unitRate || 0);
  const revpar = totalUnits > 0 ? (Number(revenueThis._sum.amount || 0) / totalUnits) : 0;

  // Last 14 days revenue chart
  type DayRow = { day: Date; total: number | string };
  const last14Days: DayRow[] = await prisma.$queryRawUnsafe(
    `SELECT DATE("paidAt") as day, SUM(amount) as total FROM "Payment" WHERE "organizationId" = $1 AND status = 'PAID' AND "paidAt" >= $2 GROUP BY DATE("paidAt") ORDER BY day ASC`,
    orgId, subDays(now, 14)
  ) as DayRow[];
  const days: { day: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = format(subDays(now, i), 'MMM d');
    const found = last14Days.find((x) => format(new Date(x.day), 'MMM d') === d);
    days.push({ day: d, total: Number(found?.total || 0) });
  }
  const maxRev = Math.max(...days.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600">Operational and financial performance for this month.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard label="Revenue (MTD)" value={formatCurrency(Number(revenueThis._sum.amount || 0), currency)} icon={DollarSign} />
        <StatsCard label="Bookings (MTD)" value={bookingsThisMonth} icon={Calendar} sub={`vs ${bookingsLastMonth} last month`} />
        <StatsCard label="Occupancy" value={`${occRate}%`} icon={BedDouble} sub={`${occupancy}/${totalUnits} units`} />
        <StatsCard label="ADR" value={formatCurrency(adr, currency)} icon={TrendingUp} sub="Avg daily rate" />
        <StatsCard label="RevPAR" value={formatCurrency(revpar, currency)} icon={BarChart3} sub="Revenue per available unit" />
        <StatsCard label="Last month rev" value={formatCurrency(Number(revenueLast._sum.amount || 0), currency)} icon={DollarSign} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Last 14 days revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1">
              {days.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${formatCurrency(d.total, currency)}`}>
                  <div className="w-full rounded-t bg-slate-700" style={{ height: `${(d.total / maxRev) * 100}%`, minHeight: 2 }} />
                  <div className="text-[9px] text-slate-500 -rotate-45 origin-top-left whitespace-nowrap">{d.day}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bookings by source</CardTitle></CardHeader>
          <CardContent>
            {bySource.length === 0 ? <p className="text-sm text-slate-500">No data yet</p> : (
              <div className="space-y-2">
                {bySource.map((s) => {
                  const total = bySource.reduce((acc, x) => acc + x._count._all, 0);
                  const pct = total > 0 ? (s._count._all / total) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{s.source.replace('_',' ')}</span>
                        <span className="text-slate-600">{s._count._all} · {formatCurrency(Number(s._sum.totalAmount || 0), currency)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Top guests</CardTitle></CardHeader>
          <CardContent>
            {topGuests.length === 0 ? <p className="text-sm text-slate-500">No guests yet</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Guest</th><th>Email</th><th>Stays</th><th className="text-right">Total spent</th></tr></thead>
                <tbody className="divide-y">
                  {topGuests.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2 font-medium">{g.firstName} {g.lastName}</td>
                      <td className="text-slate-600">{g.email || '—'}</td>
                      <td>{g.totalStays}</td>
                      <td className="text-right font-medium">{formatCurrency(Number(g.totalSpent), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
