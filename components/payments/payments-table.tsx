'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, statusLabel, formatCurrency, formatDate } from '@/lib/utils';

type Payment = {
  id: string; amount: number; currency: string;
  method: string; status: string; reference: string | null; paidAt: string | null;
  guest: { id: string; name: string } | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  bookingId: string | null;
};

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Guest</th>
            <th className="px-3 py-3">Booking</th>
            <th className="px-3 py-3">Invoice</th>
            <th className="px-3 py-3">Method</th>
            <th className="px-3 py-3">Reference</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-600">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
              <td className="px-3 py-2 text-slate-700">{p.guest ? <Link href={`/dashboard/reservations/guests/${p.guest.id}`} className="hover:underline">{p.guest.name}</Link> : '—'}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{p.bookingId ? <Link href={`/dashboard/reservations/bookings/${p.bookingId}`} className="hover:underline">View booking</Link> : '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.invoiceId ? <Link href={`/dashboard/finance/invoices/${p.invoiceId}`} className="hover:underline">{p.invoiceNumber || 'View'}</Link> : '—'}</td>
              <td className="px-3 py-2 text-slate-600">{p.method}</td>
              <td className="px-3 py-2 text-slate-500">{p.reference || '—'}</td>
              <td className="px-3 py-2"><Badge className={STATUS_COLORS[p.status]}>{statusLabel(p.status)}</Badge></td>
              <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.amount, p.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
