'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaskedField } from '@/components/ui/masked-field';
import { STATUS_COLORS, statusLabel, formatCurrency, formatDate } from '@/lib/utils';
import { LogIn, LogOut, CreditCard, Eye, MoreHorizontal, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentDialog } from '@/components/payments/payment-dialog';

type Booking = {
  id: string; confirmationCode: string;
  guest: { id: string; firstName: string; lastName: string; email: string | null };
  property: { id: string; name: string };
  unit: { id: string; name: string; number: string } | null;
  arrivalDate: string; departureDate: string; nights: number; adults: number; children: number;
  totalAmount: number; paidAmount: number; balance: number; currency: string;
  status: string; source: string;
  invoice: { id: string } | null;
};

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [payBooking, setPayBooking] = useState<Booking | null>(null);

  async function checkIn(id: string) {
    const res = await fetch(`/api/bookings/${id}/check-in`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
    toast.success('Checked in');
    router.refresh();
  }
  async function checkOut(id: string) {
    const res = await fetch(`/api/bookings/${id}/check-out`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
    toast.success('Checked out');
    router.refresh();
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Code</th>
            <th className="px-3 py-3">Guest</th>
            <th className="px-3 py-3">Property / Unit</th>
            <th className="px-3 py-3">Stay</th>
            <th className="px-3 py-3">Amount</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs text-slate-700">{b.confirmationCode}</td>
              <td className="px-3 py-2">
                <Link href={`/dashboard/reservations/guests/${b.guest.id}`} className="font-medium text-slate-900 hover:underline">{b.guest.firstName} {b.guest.lastName}</Link>
                <div className="text-xs text-slate-500"><MaskedField value={b.guest.email} type="email" /></div>
              </td>
              <td className="px-3 py-2 text-slate-700">
                <Link href={`/dashboard/properties/${b.property.id}`} className="hover:underline">{b.property.name}</Link>
                {b.unit && <div className="text-xs text-slate-500"><Link href={`/dashboard/properties/units`} className="hover:underline">#{b.unit.number} · {b.unit.name}</Link></div>}
              </td>
              <td className="px-3 py-2 text-slate-600">
                <div>{formatDate(b.arrivalDate)} → {formatDate(b.departureDate)}</div>
                <div className="text-xs text-slate-500">{b.nights}n · {b.adults + b.children} guests</div>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{formatCurrency(b.totalAmount, b.currency)}</div>
                {b.balance > 0 ? (
                  <div className="text-xs text-red-600">Due {formatCurrency(b.balance, b.currency)}</div>
                ) : (
                  <div className="text-xs text-emerald-600">Paid</div>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge className={STATUS_COLORS[b.status]}>{statusLabel(b.status)}</Badge>
                <div className="text-[10px] text-slate-500">{b.source}</div>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  {b.status === 'CONFIRMED' || b.status === 'PENDING' ? (
                    <Button variant="ghost" size="icon" onClick={() => checkIn(b.id)} title="Check in"><LogIn className="h-4 w-4" /></Button>
                  ) : null}
                  {b.status === 'CHECKED_IN' ? (
                    <Button variant="ghost" size="icon" onClick={() => checkOut(b.id)} title="Check out"><LogOut className="h-4 w-4" /></Button>
                  ) : null}
                  {b.balance > 0 ? (
                    <Button variant="ghost" size="icon" onClick={() => setPayBooking(b)} title="Record payment"><CreditCard className="h-4 w-4" /></Button>
                  ) : null}
                  {b.invoice && (
                    <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/finance/invoices/${b.invoice.id}`} title="View invoice"><Receipt className="h-4 w-4" /></Link></Button>
                  )}
                  <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/reservations/bookings/${b.id}`}><Eye className="h-4 w-4" /></Link></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {payBooking && (
        <PaymentDialog
          bookingId={payBooking.id}
          balance={payBooking.balance}
          currency={payBooking.currency}
          open={!!payBooking}
          onOpenChange={(o) => { if (!o) setPayBooking(null); }}
        />
      )}
    </div>
  );
}
