import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar } from 'lucide-react';
import Link from 'next/link';
import { BookingsTable } from '@/components/bookings/bookings-table';

export default async function BookingsPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId, deletedAt: null };
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.q) {
    where.OR = [
      { confirmationCode: { contains: searchParams.q, mode: 'insensitive' } },
      { guest: { firstName: { contains: searchParams.q, mode: 'insensitive' } } },
      { guest: { lastName: { contains: searchParams.q, mode: 'insensitive' } } },
      { guest: { email: { contains: searchParams.q, mode: 'insensitive' } } },
    ];
  }
  const bookings = await prisma.booking.findMany({
    where,
    include: { guest: true, unit: true, property: true, ratePlan: true, createdBy: true, invoice: { select: { id: true } } },
    orderBy: { arrivalDate: 'desc' },
    take: 100,
  });

  const STATUSES = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELED', 'NO_SHOW'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-600">All reservations across your properties.</p>
        </div>
        <Button asChild><Link href="/dashboard/reservations/bookings/new"><Plus className="h-4 w-4" /> New booking</Link></Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/dashboard/reservations/bookings?status=${s}` : '/dashboard/reservations/bookings'}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${(searchParams.status || '') === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {s ? s.replace(/_/g, ' ').toLowerCase() : 'All'}
            </Link>
          ))}
        </div>
        <form className="sm:ml-auto">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search guest, code, email…"
            className="h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 sm:w-64"
          />
        </form>
      </div>

      {bookings.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No bookings found</h2>
          <p className="mt-1 text-sm text-slate-600">Create a new reservation to get started.</p>
          <Button asChild className="mt-4"><Link href="/dashboard/reservations/bookings/new">New booking</Link></Button>
        </CardContent></Card>
      ) : (
        <BookingsTable bookings={bookings.map((b) => ({
          id: b.id,
          confirmationCode: b.confirmationCode,
          guest: { id: b.guest.id, firstName: b.guest.firstName, lastName: b.guest.lastName, email: b.guest.email },
          property: { id: b.property.id, name: b.property.name },
          unit: b.unit ? { id: b.unit.id, name: b.unit.name, number: b.unit.number } : null,
          arrivalDate: b.arrivalDate.toISOString(),
          departureDate: b.departureDate.toISOString(),
          nights: b.nights,
          adults: b.adults,
          children: b.children,
          totalAmount: Number(b.totalAmount),
          paidAmount: Number(b.paidAmount),
          balance: Number(b.balance),
          currency: b.currency,
          status: b.status,
          source: b.source,
          invoice: b.invoice ? { id: b.invoice.id } : null,
        }))} />
      )}
    </div>
  );
}
