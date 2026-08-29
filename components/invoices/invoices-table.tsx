'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, statusLabel, formatCurrency, formatDate } from '@/lib/utils';

type Invoice = {
  id: string; invoiceNumber: string; status: string;
  issueDate: string; dueDate: string;
  total: number; paidAmount: number; balance: number; currency: string;
  guest: { name: string } | null;
  bookingId: string | null;
};

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Invoice</th>
            <th className="px-3 py-3">Guest</th>
            <th className="px-3 py-3">Issued</th>
            <th className="px-3 py-3">Due</th>
            <th className="px-3 py-3">Total</th>
            <th className="px-3 py-3">Balance</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((i) => (
            <tr key={i.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs"><Link href={`/dashboard/invoices/${i.id}`} className="hover:underline">{i.invoiceNumber}</Link></td>
              <td className="px-3 py-2 text-slate-700">{i.guest?.name || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{formatDate(i.issueDate)}</td>
              <td className="px-3 py-2 text-slate-600">{formatDate(i.dueDate)}</td>
              <td className="px-3 py-2 font-medium">{formatCurrency(i.total, i.currency)}</td>
              <td className="px-3 py-2">{i.balance > 0 ? <span className="text-red-600 font-medium">{formatCurrency(i.balance, i.currency)}</span> : <span className="text-slate-500">—</span>}</td>
              <td className="px-3 py-2"><Badge className={STATUS_COLORS[i.status]}>{statusLabel(i.status)}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
