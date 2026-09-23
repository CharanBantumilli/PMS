'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, CreditCard, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { formatCurrency } from '@/lib/utils';

export function BookingActions({ bookingId, status, balance, currency = 'USD' }: { bookingId: string; status: string; balance: number; currency?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPay, setShowPay] = useState(false);

  const canCheckIn = ['PENDING', 'CONFIRMED'].includes(status);
  const isPaid = balance <= 0;

  async function doAction(path: string, method = 'POST', body?: any) {
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
    toast.success('Done');
    router.refresh();
  }

  async function cancel() {
    if (!confirm('Cancel this booking?')) return;
    doAction('', 'PATCH', { status: 'CANCELED' });
  }

  return (
    <div className="space-y-2">
      {canCheckIn && !isPaid && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Full payment of <strong>{formatCurrency(balance, currency)}</strong> required before check-in</span>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setShowPay(true)}>
            <CreditCard className="mr-1 h-3 w-3" /> Pay now
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canCheckIn && (
          <Button onClick={() => doAction('/check-in')} disabled={loading || !isPaid} title={!isPaid ? 'Payment required' : 'Check in guest'}>
            <LogIn className="h-4 w-4" /> Check in
          </Button>
        )}
        {status === 'CHECKED_IN' && (
          <Button onClick={() => doAction('/check-out')} disabled={loading}><LogOut className="h-4 w-4" /> Check out</Button>
        )}
        {balance > 0 && status !== 'CANCELED' && (
          <Button variant="outline" onClick={() => setShowPay(true)}><CreditCard className="h-4 w-4" /> Record payment</Button>
        )}
        {['PENDING', 'CONFIRMED'].includes(status) && (
          <Button variant="ghost" onClick={cancel} disabled={loading}><X className="h-4 w-4" /> Cancel</Button>
        )}
      </div>
      {showPay && (
        <PaymentDialog
          bookingId={bookingId}
          balance={balance}
          currency={currency}
          open={showPay}
          onOpenChange={setShowPay}
        />
      )}
    </div>
  );
}
