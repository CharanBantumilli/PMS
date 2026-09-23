import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { PaymentsTable } from '@/components/payments/payments-table';
import { formatCurrency } from '@/lib/utils';

export default async function PaymentsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId };
  if (searchParams.status) where.status = searchParams.status;
  const [payments, org] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: { include: { booking: { include: { guest: true } } } } },
      orderBy: { paidAt: 'desc' },
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);

  const paidPayments = payments.filter((p) => p.status === 'PAID');
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PARTIAL').reduce((s, p) => s + Number(p.amount), 0);

  const STATUSES = ['', 'PENDING', 'PAID', 'FAILED'];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
        <p className="text-sm text-slate-600">All incoming payments across bookings and invoices.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total received</div><div className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid, org?.currency || 'INR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Pending</div><div className="mt-1 text-2xl font-bold text-amber-600">{formatCurrency(totalPending, org?.currency || 'INR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Transactions</div><div className="mt-1 text-2xl font-bold">{payments.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Avg. ticket</div><div className="mt-1 text-2xl font-bold">{formatCurrency(paidPayments.length ? (totalPaid / paidPayments.length) : 0, org?.currency || 'INR')}</div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s || 'all'} href={s ? `/dashboard/finance/payments?status=${s}` : '/dashboard/finance/payments'} className={`rounded-full border px-3 py-1 text-xs font-medium ${(searchParams.status || '') === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {s ? s.toLowerCase() : 'All'}
          </Link>
        ))}
      </div>
      {payments.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No payments yet</h2>
          <p className="mt-1 text-sm text-slate-600">Record payments from a booking's detail page.</p>
        </CardContent></Card>
      ) : (
        <PaymentsTable payments={payments.map((p) => ({
          id: p.id, amount: Number(p.amount), currency: p.currency,
          method: p.method, status: p.status, reference: p.reference, paidAt: p.paidAt?.toISOString() || null,
          guest: p.invoice?.booking?.guest ? { id: p.invoice.booking.guest.id, name: `${p.invoice.booking.guest.firstName} ${p.invoice.booking.guest.lastName}` } : null,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice?.invoiceNumber,
          bookingId: p.invoice?.bookingId,
        }))} />
      )}
    </div>
  );
}
