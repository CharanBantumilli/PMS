import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingForm } from '@/components/bookings/booking-form';
import Link from 'next/link';

export default async function NewBookingPage({ searchParams }: { searchParams: { propertyId?: string; unitId?: string; arrivalDate?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [properties, guests, ratePlans, org] = await Promise.all([
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.guest.findMany({ where: { organizationId: orgId }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 200 }),
    prisma.ratePlan.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/reservations/bookings" className="hover:text-slate-900">← Back to bookings</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>New booking</CardTitle></CardHeader>
        <CardContent>
          <BookingForm
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
            guests={guests.map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName, email: g.email }))}
            ratePlans={ratePlans.map((r) => ({ id: r.id, name: r.name, basePrice: Number(r.basePrice) }))}
            defaultPropertyId={searchParams.propertyId}
            defaultUnitId={searchParams.unitId}
            defaultArrivalDate={searchParams.arrivalDate}
            currency={org?.currency || 'INR'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
