import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatDateTime, STATUS_COLORS, statusLabel } from '@/lib/utils';
import { LogIn, LogOut, CreditCard, ArrowLeft, ShieldCheck } from 'lucide-react';
import { BookingActions } from '@/components/bookings/booking-actions';
import { DeleteConfirm } from '@/components/ui/delete-confirm';
import { MaskedField } from '@/components/ui/masked-field';

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { guest: true, unit: true, property: true, ratePlan: true, payments: { orderBy: { paidAt: 'desc' } }, invoice: true },
  });
  if (!booking) notFound();
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
  const currency = booking.currency || org?.currency || 'INR';
  const canDelete = ['OWNER', 'ADMIN'].includes(session!.user.role as string);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/reservations/bookings" className="hover:text-slate-900">← Back to bookings</Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Booking {booking.confirmationCode}</h1>
            <Badge className={STATUS_COLORS[booking.status]}>{statusLabel(booking.status)}</Badge>
          </div>
          <p className="text-sm text-slate-600">Created {formatDateTime(booking.createdAt)} · Source: {booking.source}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BookingActions bookingId={booking.id} status={booking.status} balance={Number(booking.balance)} currency={currency} />
          {canDelete && <DeleteConfirm entityName={`booking ${booking.confirmationCode}`} deleteUrl={`/api/bookings/${booking.id}`} redirectUrl="/dashboard/reservations/bookings" />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Stay details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs uppercase text-slate-500">Property</div><div className="font-medium"><Link href={`/dashboard/properties/${booking.property.id}`} className="hover:underline">{booking.property.name}</Link></div></div>
            <div><div className="text-xs uppercase text-slate-500">Unit</div><div className="font-medium">{booking.unit ? <Link href={`/dashboard/properties/units`} className="hover:underline">#{booking.unit.number} {booking.unit.name}</Link> : '— Unassigned —'}</div></div>
            <div><div className="text-xs uppercase text-slate-500">Arrival</div><div className="font-medium">{formatDate(booking.arrivalDate)}</div></div>
            <div><div className="text-xs uppercase text-slate-500">Departure</div><div className="font-medium">{formatDate(booking.departureDate)}</div></div>
            <div><div className="text-xs uppercase text-slate-500">Nights</div><div className="font-medium">{booking.nights}</div></div>
            <div><div className="text-xs uppercase text-slate-500">Guests</div><div className="font-medium">{booking.adults} adults, {booking.children} children</div></div>
            <div><div className="text-xs uppercase text-slate-500">Rate plan</div><div className="font-medium">{booking.ratePlan?.name || 'Custom'}</div></div>
            <div><div className="text-xs uppercase text-slate-500">Rate / night</div><div className="font-medium">{formatCurrency(Number(booking.unitRate), booking.currency)}</div></div>
            {booking.specialRequests && <div className="col-span-2"><div className="text-xs uppercase text-slate-500">Special requests</div><div>{booking.specialRequests}</div></div>}
            {booking.internalNotes && <div className="col-span-2"><div className="text-xs uppercase text-slate-500">Internal notes</div><div>{booking.internalNotes}</div></div>}
            {booking.checkedInAt && <div><div className="text-xs uppercase text-slate-500">Checked in</div><div className="font-medium">{formatDateTime(booking.checkedInAt)}</div></div>}
            {booking.checkedOutAt && <div><div className="text-xs uppercase text-slate-500">Checked out</div><div className="font-medium">{formatDateTime(booking.checkedOutAt)}</div></div>}
            {booking.guestIdType && (
              <div className="col-span-2 rounded-md border border-dashed border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium text-slate-700">Guest ID verified:</span>
                  <span className="text-slate-600">{booking.guestIdType.replace('_', ' ')}</span>
                  <span className="font-mono text-slate-500">{booking.guestIdNumber}</span>
                  {booking.idVerifiedAt && <span className="text-slate-400">· {formatDateTime(booking.idVerifiedAt)}</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Guest</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/dashboard/reservations/guests/${booking.guest.id}`} className="font-medium text-slate-900 hover:underline">
              {booking.guest.firstName} {booking.guest.lastName}
            </Link>
            <div className="mt-2 text-sm text-slate-600">
              {booking.guest.email && <div><MaskedField value={booking.guest.email} type="email" /></div>}
              {booking.guest.phone && <div><MaskedField value={booking.guest.phone} type="phone" /></div>}
            </div>
            <div className="mt-3 text-xs text-slate-500">{booking.guest.totalStays} prior stays · {formatCurrency(Number(booking.guest.totalSpent), currency)} spent</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {booking.invoice && (
              <div className="mb-2"><Link href={`/dashboard/finance/invoices/${booking.invoice.id}`} className="text-xs font-medium text-slate-900 hover:underline">View invoice →</Link></div>
            )}
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(booking.unitRate) * booking.nights, booking.currency)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Discount</span><span>−{formatCurrency(Number(booking.discount), booking.currency)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>+{formatCurrency(Number(booking.taxAmount), booking.currency)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(Number(booking.totalAmount), booking.currency)}</span></div>
            <div className="mt-2 flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(Number(booking.paidAmount), booking.currency)}</span></div>
            <div className="flex justify-between text-red-600"><span>Balance</span><span>{formatCurrency(Number(booking.balance), booking.currency)}</span></div>
            {Number(booking.balance) > 0 && ['PENDING', 'CONFIRMED'].includes(booking.status) && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                Payment required before check-in
              </div>
            )}
            {Number(booking.balance) <= 0 && ['PENDING', 'CONFIRMED'].includes(booking.status) && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                Fully paid — ready for check-in
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent>
            {booking.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr><th className="py-2">Date</th><th>Method</th><th>Reference</th><th>Status</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y">
                  {booking.payments.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50">
                        <td className="py-2">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                        <td>{p.method}</td>
                        <td className="text-slate-500">{p.reference || '—'}</td>
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
    </div>
  );
}
