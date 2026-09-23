import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { addDays, format, startOfDay } from 'date-fns';
import { CalendarView } from '@/components/calendar/calendar-view';

export default async function CalendarPage({ searchParams }: { searchParams: { propertyId?: string; from?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const from = searchParams.from ? new Date(searchParams.from) : startOfDay(new Date());
  const to = addDays(from, 14);
  const where: any = { organizationId: orgId, status: { in: ['PENDING','CONFIRMED','CHECKED_IN'] } };
  if (searchParams.propertyId) where.propertyId = searchParams.propertyId;

  const [bookings, properties, units] = await Promise.all([
    prisma.booking.findMany({
      where, include: { guest: true, unit: true, property: true },
      orderBy: { arrivalDate: 'asc' },
    }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { number: 'asc' } }),
  ]);

  const propertyId = searchParams.propertyId || properties[0]?.id;
  const propertyUnits = propertyId ? units.filter((u) => u.propertyId === propertyId) : units;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-600">14-day reservation timeline across units.</p>
        </div>
      </div>
      {properties.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No properties yet</h2>
        </CardContent></Card>
      ) : (
        <CalendarView
          from={from.toISOString()}
          days={Array.from({ length: 14 }, (_, i) => format(addDays(from, i), 'yyyy-MM-dd'))}
          units={propertyUnits.map((u) => ({ id: u.id, number: u.number, name: u.name, propertyId: u.propertyId }))}
          bookings={bookings
            .filter((b) => !propertyId || b.propertyId === propertyId)
            .map((b) => ({
              id: b.id, unitId: b.unitId, guest: `${b.guest.firstName} ${b.guest.lastName}`,
              arrivalDate: b.arrivalDate.toISOString(), departureDate: b.departureDate.toISOString(),
              status: b.status, confirmationCode: b.confirmationCode,
            }))}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          activePropertyId={propertyId}
        />
      )}
    </div>
  );
}
