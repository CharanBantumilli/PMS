import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaskedField } from '@/components/ui/masked-field';
import { formatCurrency, formatDate, STATUS_COLORS, statusLabel } from '@/lib/utils';
import { InvoiceActions } from '@/components/invoices/invoice-actions';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { booking: { include: { guest: true, property: true, unit: true } }, payments: { orderBy: { paidAt: 'desc' } }, items: true },
  });
  if (!invoice) notFound();
  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  const gstin = org?.gstin || org?.taxId || null;
  const legalName = org?.legalName || org?.name;
  const sacCode = invoice.sacCode || org?.sacCode || '9961';
  const cgst = Number(invoice.cgstAmount);
  const sgst = Number(invoice.sgstAmount);
  const igst = Number(invoice.igstAmount);
  const gstRate = Number(invoice.gstRate);
  const hasGstSplit = cgst > 0 || sgst > 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/finance/invoices" className="hover:text-slate-900">← Back to invoices</Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl">Tax Invoice</CardTitle>
            <div className="mt-1 text-sm text-slate-600">Invoice No: {invoice.invoiceNumber}</div>
            <div className="text-sm text-slate-600">Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}</div>
          </div>
          <div className="flex items-center gap-3">
            <InvoiceActions invoiceId={invoice.id} guestEmail={invoice.booking?.guest?.email} invoiceNumber={invoice.invoiceNumber} />
            <Badge className={STATUS_COLORS[invoice.status]}>{statusLabel(invoice.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-slate-500">Supplier Details</div>
              <div className="font-semibold text-slate-900">{legalName}</div>
              {gstin && <div className="text-sm font-medium text-slate-700">GSTIN: {gstin}</div>}
              <div className="text-sm text-slate-600">
                {[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ') || '—'}
              </div>
              <div className="text-sm text-slate-600">
                {[org?.city, org?.state, org?.postalCode].filter(Boolean).join(', ')} {org?.country ?? ''}
              </div>
              <div className="text-sm text-slate-600">{org?.phone}</div>
              <div className="text-sm text-slate-600">{org?.email}</div>
              <div className="mt-1 text-xs text-slate-500">SAC: {sacCode}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Bill To</div>
              {invoice.booking ? (
                <>
                  <div className="font-semibold text-slate-900"><Link href={`/dashboard/reservations/guests/${invoice.booking.guest.id}`} className="hover:underline">{invoice.booking.guest.firstName} {invoice.booking.guest.lastName}</Link></div>
                  <div className="text-sm text-slate-600"><MaskedField value={invoice.booking.guest.email} type="email" /></div>
                  {invoice.booking.guest.phone && <div className="text-sm text-slate-600"><MaskedField value={invoice.booking.guest.phone} type="phone" /></div>}
                  {invoice.booking.guest.gstin && <div className="text-sm font-medium text-slate-700">GSTIN: {invoice.booking.guest.gstin}</div>}
                  {invoice.booking.guest.state && <div className="text-sm text-slate-600">State: {invoice.booking.guest.state}</div>}
                  <div className="mt-1 text-xs text-slate-500">Booking: <Link href={`/dashboard/reservations/bookings/${invoice.bookingId}`} className="hover:underline">{invoice.booking.confirmationCode}</Link></div>
                </>
              ) : <div className="text-sm text-slate-500">—</div>}
            </div>
          </div>

          <div className="overflow-x-auto">
          <table className="mt-6 w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No line items</td></tr>
              ) : invoice.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2">{it.description}</td>
                  <td className="text-right">{Number(it.quantity)}</td>
                  <td className="text-right">{formatCurrency(Number(it.unitPrice), invoice.currency)}</td>
                  <td className="text-right font-medium">{formatCurrency(Number(it.quantity) * Number(it.unitPrice), invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-80 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span></div>
              {hasGstSplit ? (
                <>
                  <div className="flex justify-between"><span>CGST @ {(gstRate / 2).toFixed(1)}%</span><span>{formatCurrency(cgst, invoice.currency)}</span></div>
                  <div className="flex justify-between"><span>SGST @ {(gstRate / 2).toFixed(1)}%</span><span>{formatCurrency(sgst, invoice.currency)}</span></div>
                </>
              ) : igst > 0 ? (
                <div className="flex justify-between"><span>IGST @ {gstRate}%</span><span>{formatCurrency(igst, invoice.currency)}</span></div>
              ) : (
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(Number(invoice.taxAmount), invoice.currency)}</span></div>
              )}
              {Number(invoice.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(Number(invoice.discount), invoice.currency)}</span></div>}
              <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(Number(invoice.total), invoice.currency)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(Number(invoice.paidAmount), invoice.currency)}</span></div>
              <div className="flex justify-between text-red-600"><span>Balance due</span><span>{formatCurrency(Number(invoice.balance), invoice.currency)}</span></div>
            </div>
          </div>

          {invoice.payments.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold">Payments</div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50">
                      <Link href={`/dashboard/reservations/bookings/${invoice.bookingId}`} className="contents">
                        <td className="py-2">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                        <td>{p.method}</td>
                        <td><Badge className={STATUS_COLORS[p.status]}>{statusLabel(p.status)}</Badge></td>
                        <td className="text-right font-medium">{formatCurrency(Number(p.amount), p.currency)}</td>
                      </Link>
                    </tr>
                  ))}
                </tbody>
          </table>
          </div>
            </div>
          )}
          {invoice.status !== 'PAID' && invoice.bookingId && (
            <div className="mt-4">
              <Link href={`/dashboard/reservations/bookings/${invoice.bookingId}`}>
                <Button>Record payment</Button>
              </Link>
            </div>
          )}
          {(invoice.booking?.property as any)?.policies && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Policies</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{(invoice.booking?.property as any).policies}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
