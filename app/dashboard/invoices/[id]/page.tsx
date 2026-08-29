import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, STATUS_COLORS, statusLabel } from '@/lib/utils';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { booking: { include: { guest: true, property: true, unit: true } }, payments: { orderBy: { paidAt: 'desc' } }, items: true },
  });
  if (!invoice) notFound();
  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/invoices" className="hover:text-slate-900">← Back to invoices</Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl">Invoice {invoice.invoiceNumber}</CardTitle>
            <div className="mt-1 text-sm text-slate-600">Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}</div>
          </div>
          <Badge className={STATUS_COLORS[invoice.status]}>{statusLabel(invoice.status)}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-slate-500">From</div>
              <div className="font-semibold text-slate-900">{org?.name}</div>
              <div className="text-sm text-slate-600">
                {[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ') || '—'}
              </div>
              <div className="text-sm text-slate-600">
                {[org?.city, org?.state, org?.postalCode].filter(Boolean).join(', ')} {org?.country ?? ''}
              </div>
              <div className="text-sm text-slate-600">{org?.phone}</div>
              <div className="text-sm text-slate-600">{org?.email}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Bill to</div>
              {invoice.booking ? (
                <>
                  <div className="font-semibold text-slate-900">{invoice.booking.guest.firstName} {invoice.booking.guest.lastName}</div>
                  <div className="text-sm text-slate-600">{invoice.booking.guest.email}</div>
                </>
              ) : <div className="text-sm text-slate-500">—</div>}
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">Description</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No line items</td></tr>
              ) : invoice.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2">{it.description}</td>
                  <td className="text-right">{Number(it.quantity)}</td>
                  <td className="text-right">{formatCurrency(Number(it.unitPrice), invoice.currency)}</td>
                  <td className="text-right font-medium">{formatCurrency(Number(it.total), invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(Number(invoice.taxAmount), invoice.currency)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(Number(invoice.discount), invoice.currency)}</span></div>
              <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(Number(invoice.total), invoice.currency)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(Number(invoice.paidAmount), invoice.currency)}</span></div>
              <div className="flex justify-between text-red-600"><span>Balance due</span><span>{formatCurrency(Number(invoice.balance), invoice.currency)}</span></div>
            </div>
          </div>

          {invoice.payments.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold">Payments</div>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                      <td>{p.method}</td>
                      <td><Badge className={STATUS_COLORS[p.status]}>{statusLabel(p.status)}</Badge></td>
                      <td className="text-right font-medium">{formatCurrency(Number(p.amount), p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
