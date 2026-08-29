import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import { PaymentsTable } from '@/components/payments/payments-table';
import { formatCurrency } from '@/lib/utils';

export default async function PaymentsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [payments, org] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { invoice: { include: { booking: { include: { guest: true } } } } },
      orderBy: { paidAt: 'desc' },
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);

  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + Number(p.amount), 0);

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
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Avg. ticket</div><div className="mt-1 text-2xl font-bold">{formatCurrency(payments.length ? (totalPaid / payments.filter((p) => p.status === 'PAID').length || 0) : 0, org?.currency || 'INR')}</div></CardContent></Card>
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
          guest: p.invoice?.booking?.guest ? `${p.invoice.booking.guest.firstName} ${p.invoice.booking.guest.lastName}` : null,
          invoiceNumber: p.invoice?.invoiceNumber,
        }))} />
      )}
    </div>
  );
}
