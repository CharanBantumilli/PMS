import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PropertyForm } from '@/components/properties/property-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const property = await prisma.property.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { _count: { select: { units: true } } },
  });
  if (!property) notFound();

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/properties" className="hover:text-slate-900">← Back to properties</Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{property.name}</h1>
            <Badge variant={property.isActive ? 'success' : 'secondary'}>{property.isActive ? 'Active' : 'Inactive'}</Badge>
          </div>
          <p className="text-sm text-slate-600">{property._count.units} unit{property._count.units !== 1 ? 's' : ''} · Code {property.code}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/properties/units?propertyId=${property.id}`} className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">View units</Link>
          <Link href={`/dashboard/reservations/bookings?propertyId=${property.id}`} className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Bookings</Link>
          <Link href={`/dashboard/operations/housekeeping`} className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Housekeeping</Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Property details</CardTitle></CardHeader>
        <CardContent>
          <PropertyForm mode="edit" initial={{
            id: property.id,
            name: property.name,
            code: property.code,
            type: property.type,
            description: property.description,
            starRating: property.starRating,
            addressLine1: property.addressLine1,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
            country: property.country,
            phone: property.phone,
            email: property.email,
            policies: property.policies,
          }} />
        </CardContent>
      </Card>
    </div>
  );
}
