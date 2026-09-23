'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Mail, Loader2 } from 'lucide-react';
import { STATUS_COLORS, statusLabel, formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type Invoice = {
  id: string; invoiceNumber: string; status: string;
  issueDate: string; dueDate: string;
  total: number; paidAmount: number; balance: number; currency: string;
  guest: { id: string; name: string; email?: string | null } | null;
  bookingId: string | null;
};

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
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
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((i) => (
            <InvoiceRow key={i.id} invoice={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({ invoice: i }: { invoice: Invoice }) {
  const [sending, setSending] = useState(false);

  function handlePrint() {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) { toast.error('Pop-up blocked'); return; }
    fetch(`/api/invoices/${i.id}/print`).then((r) => r.text()).then((html) => {
      w.document.write(html);
      w.document.close();
      w.onload = () => w.print();
    }).catch(() => toast.error('Failed'));
  }

  async function handleSend() {
    const email = i.guest?.email;
    if (!email) { toast.error('No guest email'); return; }
    if (!confirm(`Send ${i.invoiceNumber} to ${email}?`)) return;
    setSending(true);
    const res = await fetch(`/api/invoices/${i.id}/send`, { method: 'POST' });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(`Sent to ${email}`);
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 font-mono text-xs"><Link href={`/dashboard/finance/invoices/${i.id}`} className="hover:underline">{i.invoiceNumber}</Link></td>
      <td className="px-3 py-2 text-slate-700">{i.guest ? <Link href={`/dashboard/reservations/guests/${i.guest.id}`} className="hover:underline">{i.guest.name}</Link> : '—'}</td>
      <td className="px-3 py-2 text-slate-600">{formatDate(i.issueDate)}</td>
      <td className="px-3 py-2 text-slate-600">{formatDate(i.dueDate)}</td>
      <td className="px-3 py-2 font-medium">{formatCurrency(i.total, i.currency)}</td>
      <td className="px-3 py-2">{i.balance > 0 ? <span className="text-red-600 font-medium">{formatCurrency(i.balance, i.currency)}</span> : <span className="text-slate-500">—</span>}</td>
      <td className="px-3 py-2"><Badge className={STATUS_COLORS[i.status]}>{statusLabel(i.status)}</Badge></td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrint} title="Print"><Printer className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSend} disabled={sending || !i.guest?.email} title="Send email">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}
