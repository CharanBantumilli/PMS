import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { PropertiesTable } from '@/components/properties/properties-table';

export default async function PropertiesPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [properties, org] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findUnique({ where: { id: orgId } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Properties</h1>
          <p className="text-sm text-slate-600">Manage your hotels, hostels, apartments and vacation rentals.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/properties/new"><Plus className="h-4 w-4" /> New property</Link>
        </Button>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No properties yet</h2>
            <p className="mt-1 text-sm text-slate-600">Create your first property to start managing units and reservations.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/properties/new"><Plus className="h-4 w-4" /> Create property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PropertiesTable
          properties={properties.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            type: p.type,
            city: p.city,
            country: p.country,
            starRating: p.starRating,
            isActive: p.isActive,
            unitCount: p._count.units,
            address: [p.addressLine1, p.city, p.country].filter(Boolean).join(', '),
          }))}
        />
      )}
    </div>
  );
}
