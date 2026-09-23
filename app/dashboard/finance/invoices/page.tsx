import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { InvoicesTable } from '@/components/invoices/invoices-table';

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId };
  if (searchParams.status) where.status = searchParams.status;
  const invoices = await prisma.invoice.findMany({
    where,
    include: { booking: { include: { guest: true } }, payments: true },
    orderBy: { issueDate: 'desc' },
    take: 200,
  });

  const STATUSES = ['', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'VOID'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600">Manage invoices, taxes and payment status.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s || 'all'} href={s ? `/dashboard/finance/invoices?status=${s}` : '/dashboard/finance/invoices'} className={`rounded-full border px-3 py-1 text-xs font-medium ${(searchParams.status || '') === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {s ? s.toLowerCase() : 'All'}
          </Link>
        ))}
      </div>
      {invoices.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Receipt className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No invoices yet</h2>
          <p className="mt-1 text-sm text-slate-600">Invoices are generated automatically when bookings are confirmed or checked out.</p>
        </CardContent></Card>
      ) : (
        <InvoicesTable invoices={invoices.map((i) => ({
          id: i.id, invoiceNumber: i.invoiceNumber, status: i.status,
          issueDate: i.issueDate.toISOString(), dueDate: i.dueDate.toISOString(),
          total: Number(i.total), paidAmount: Number(i.paidAmount), balance: Number(i.balance), currency: i.currency,
          guest: i.booking ? { id: i.booking.guest.id, name: `${i.booking.guest.firstName} ${i.booking.guest.lastName}` } : null,
          bookingId: i.bookingId,
        }))} />
      )}
    </div>
  );
}
