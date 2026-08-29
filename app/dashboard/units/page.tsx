import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, BedDouble } from 'lucide-react';
import Link from 'next/link';
import { UnitsBoard } from '@/components/units/units-board';

export default async function UnitsPage({ searchParams }: { searchParams: { propertyId?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const propertyId = searchParams.propertyId;

  const where: any = { organizationId: orgId, isActive: true };
  if (propertyId) where.propertyId = propertyId;

  const [units, properties, unitTypes, org] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: { property: true, unitType: true },
      orderBy: [{ property: { name: 'asc' } }, { number: 'asc' }],
    }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.unitTypeDefinition.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Units &amp; Rooms</h1>
          <p className="text-sm text-slate-600">Visual room board with live housekeeping and maintenance status.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/dashboard/units/types">Unit types</Link></Button>
          <Button asChild><Link href="/dashboard/units/new"><Plus className="h-4 w-4" /> New unit</Link></Button>
        </div>
      </div>

      {properties.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <BedDouble className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No properties yet</h2>
          <p className="mt-1 text-sm text-slate-600">Create a property before adding units.</p>
          <Button asChild className="mt-4"><Link href="/dashboard/properties/new">Create property</Link></Button>
        </CardContent></Card>
      ) : (
        <UnitsBoard
          units={units.map((u) => ({
            id: u.id,
            number: u.number,
            name: u.name,
            status: u.status,
            floor: u.floor,
            notes: u.notes,
            propertyId: u.propertyId,
            propertyName: u.property.name,
            unitType: u.unitType ? { name: u.unitType.name, basePrice: Number(u.unitType.basePrice) } : null,
          }))}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          unitTypes={unitTypes.map((t) => ({ id: t.id, name: t.name, basePrice: Number(t.basePrice) }))}
          activePropertyId={propertyId}
          currency={org?.currency || 'INR'}
        />
      )}
    </div>
  );
}
