'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';

const METHODS = ['CASH', 'CARD', 'UPI', 'NETBANKING', 'BANK_TRANSFER', 'CHEQUE', 'PAYPAL', 'STRIPE', 'OTHER'];
const STATUSES = ['PAID', 'PENDING', 'PARTIAL'];

type BookingDetails = {
  id: string; confirmationCode: string; totalAmount: number; balance: number; paidAmount: number;
  nights: number; unitRate: number; taxAmount: number; discount: number; currency: string;
  arrivalDate: string; departureDate: string;
  guest: { firstName: string; lastName: string; email: string | null; phone: string | null };
  property: { name: string };
  unit: { number: string; name: string } | null;
};

export function PaymentDialog({
  bookingId,
  balance,
  currency = 'USD',
  open,
  onOpenChange,
}: {
  bookingId: string;
  balance: number;
  currency?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [previewAmount, setPreviewAmount] = useState(balance);
  const [previewMethod, setPreviewMethod] = useState('CARD');
  const [previewStatus, setPreviewStatus] = useState('PAID');

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoadingBooking(true);
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((data) => {
        const b = (data.data || data)?.find((x: any) => x.id === bookingId);
        if (b) setBooking(b);
        setLoadingBooking(false);
      })
      .catch(() => setLoadingBooking(false));
  }, [open, bookingId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get('amount'));
    const method = form.get('method');
    const status = form.get('status');
    const reference = form.get('reference') || null;
    const notes = form.get('notes') || null;

    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingId, amount, method, status, reference, notes }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to record payment'); return; }
    toast.success('Payment recorded — invoice updated');
    onOpenChange(false);
    router.refresh();
  }

  const invoiceSubtotal = booking ? Number(booking.nights) * Number(booking.unitRate) : 0;
  const invoiceTotal = booking ? Math.max(0, invoiceSubtotal - Number(booking.discount) + Number(booking.taxAmount)) : 0;
  const invoiceBalance = booking ? Math.max(0, invoiceTotal - Number(booking.paidAmount)) : 0;
  const newBalance = booking ? Math.max(0, invoiceBalance - previewAmount) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        {loadingBooking ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading booking details…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Invoice Preview */}
            {booking && (
              <div className="rounded-lg border bg-white text-sm">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">Invoice Preview</span>
                  <span className="ml-auto text-xs text-slate-400">{booking.confirmationCode}</span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>{booking.guest.firstName} {booking.guest.lastName}</span>
                    <span>{booking.property.name}{booking.unit ? ` · #${booking.unit.number}` : ''}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>{formatDate(booking.arrivalDate)} → {formatDate(booking.departureDate)}</span>
                    <span>{booking.nights} night{booking.nights !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="border-t pt-1 mt-1 space-y-0.5">
                    <div className="flex justify-between"><span className="text-slate-600">{booking.nights} × {formatCurrency(booking.unitRate, currency)}</span><span>{formatCurrency(invoiceSubtotal, currency)}</span></div>
                    {booking.discount > 0 && <div className="flex justify-between text-slate-600"><span>Discount</span><span>−{formatCurrency(booking.discount, currency)}</span></div>}
                    {booking.taxAmount > 0 && <div className="flex justify-between text-slate-600"><span>Tax</span><span>+{formatCurrency(booking.taxAmount, currency)}</span></div>}
                    <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{formatCurrency(invoiceTotal, currency)}</span></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 border-t pt-1">
                    <span>Paid so far</span><span>{formatCurrency(booking.paidAmount, currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment form */}
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Outstanding balance</span>
                <span className="font-bold text-red-600">{formatCurrency(invoiceBalance, currency)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min={0.01} max={invoiceBalance} required defaultValue={invoiceBalance} onChange={(e) => setPreviewAmount(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="method">Payment method</Label>
                <SelectHTML id="method" name="method" required defaultValue="CARD" onChange={(e) => setPreviewMethod(e.target.value)}>
                  {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </SelectHTML>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <SelectHTML id="status" name="status" required defaultValue="PAID" onChange={(e) => setPreviewStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectHTML>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference</Label>
                <Input id="reference" name="reference" placeholder="TXN-12345" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional notes" />
            </div>

            {/* Post-payment summary */}
            <div className="rounded-md border bg-emerald-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">After this payment</span>
                <span className="font-bold text-emerald-700">Balance: {formatCurrency(newBalance, currency)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {previewStatus === 'PAID' ? `Payment of ${formatCurrency(previewAmount, currency)} via ${previewMethod.replace(/_/g, ' ')} will be added to the invoice` : `Payment marked as ${previewStatus}`}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Record payment</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
