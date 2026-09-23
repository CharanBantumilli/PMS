import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { StatsCard } from '@/components/dashboard/stats-card';
import { DollarSign, TrendingUp, Users, BedDouble, Calendar, BarChart3 } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, subDays, format } from 'date-fns';
import { ReportsLineChart } from '@/components/reports/reports-line-chart';

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

  // Last 30 days chart data (revenue + bookings)
  type RevenueRow = { day: Date; total: number | string };
  type BookingRow = { day: Date; count: bigint };

  const [revenueRows, bookingRows] = await Promise.all([
    prisma.$queryRawUnsafe<RevenueRow[]>(
      `SELECT DATE("paidAt") as day, SUM(amount) as total FROM "Payment" WHERE "organizationId" = $1 AND status = 'PAID' AND "paidAt" >= $2 GROUP BY DATE("paidAt") ORDER BY day ASC`,
      orgId, subDays(now, 30)
    ),
    prisma.$queryRawUnsafe<BookingRow[]>(
      `SELECT DATE("createdAt") as day, COUNT(*) as count FROM "Booking" WHERE "organizationId" = $1 AND "createdAt" >= $2 GROUP BY DATE("createdAt") ORDER BY day ASC`,
      orgId, subDays(now, 30)
    ),
  ]);

  const chartData: { date: string; revenue: number; bookings: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(now, i), 'yyyy-MM-dd');
    const rev = revenueRows.find((x) => format(new Date(x.day), 'yyyy-MM-dd') === d);
    const book = bookingRows.find((x) => format(new Date(x.day), 'yyyy-MM-dd') === d);
    chartData.push({
      date: d,
      revenue: Number(rev?.total || 0),
      bookings: Number(book?.count || 0),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600">Operational and financial performance for this month.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link href="/dashboard/finance/payments"><StatsCard label="Revenue (MTD)" value={formatCurrency(Number(revenueThis._sum.amount || 0), currency)} icon={DollarSign} /></Link>
        <Link href="/dashboard/reservations/bookings"><StatsCard label="Bookings (MTD)" value={bookingsThisMonth} icon={Calendar} sub={`vs ${bookingsLastMonth} last month`} /></Link>
        <Link href="/dashboard/properties/units"><StatsCard label="Occupancy" value={`${occRate}%`} icon={BedDouble} sub={`${occupancy}/${totalUnits} units`} /></Link>
        <Link href="/dashboard/reservations/bookings"><StatsCard label="ADR" value={formatCurrency(adr, currency)} icon={TrendingUp} sub="Avg daily rate" /></Link>
        <Link href="/dashboard/reservations/bookings"><StatsCard label="RevPAR" value={formatCurrency(revpar, currency)} icon={BarChart3} sub="Revenue per available unit" /></Link>
        <Link href="/dashboard/finance/payments"><StatsCard label="Last month rev" value={formatCurrency(Number(revenueLast._sum.amount || 0), currency)} icon={DollarSign} /></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ReportsLineChart
            data={chartData}
            currency={currency}
            title="30-Day Trends"
            description="Revenue and bookings over the last 30 days"
          />
        </div>

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
                      <td className="py-2 font-medium"><Link href={`/dashboard/reservations/guests/${g.id}`} className="hover:underline">{g.firstName} {g.lastName}</Link></td>
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
