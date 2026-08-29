'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, CreditCard, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function BookingActions({ bookingId, status, balance }: { bookingId: string; status: string; balance: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function doAction(path: string, method = 'POST', body?: any) {
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
    toast.success('Done');
    router.refresh();
  }

  async function recordPayment() {
    const amount = prompt(`Payment amount (balance: ${balance})`, String(balance || ''));
    if (!amount) return;
    const method = prompt('Method? (CASH, CARD, UPI, NETBANKING, BANK_TRANSFER, CHEQUE, PAYPAL, STRIPE, OTHER)', 'UPI') || 'UPI';
    const res = await fetch('/api/payments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId, amount: Number(amount), method, status: 'PAID' }) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Payment recorded');
    router.refresh();
  }

  async function cancel() {
    if (!confirm('Cancel this booking?')) return;
    doAction('', 'PATCH', { status: 'CANCELED' });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {['PENDING','CONFIRMED'].includes(status) && (
        <Button onClick={() => doAction('/check-in')} disabled={loading}><LogIn className="h-4 w-4" /> Check in</Button>
      )}
      {status === 'CHECKED_IN' && (
        <Button onClick={() => doAction('/check-out')} disabled={loading}><LogOut className="h-4 w-4" /> Check out</Button>
      )}
      {balance > 0 && status !== 'CANCELED' && (
        <Button variant="outline" onClick={recordPayment}><CreditCard className="h-4 w-4" /> Record payment</Button>
      )}
      {['PENDING','CONFIRMED'].includes(status) && (
        <Button variant="ghost" onClick={cancel} disabled={loading}><X className="h-4 w-4" /> Cancel</Button>
      )}
    </div>
  );
}
