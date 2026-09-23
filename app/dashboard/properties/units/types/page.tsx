import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Tag } from 'lucide-react';
import { UnitTypesTable } from '@/components/units/unit-types-table';
import { UnitTypeDialog } from '@/components/units/unit-type-dialog';
import Link from 'next/link';

export default async function UnitTypesPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [types, org] = await Promise.all([
    prisma.unitTypeDefinition.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { units: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);
  const currency = org?.currency || 'INR';

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/properties/units" className="hover:text-slate-900">← Back to units</Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unit types</h1>
          <p className="text-sm text-slate-600">Define room categories, rates, occupancy and amenities.</p>
        </div>
        <UnitTypeDialog mode="create" />
      </div>
      {types.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Tag className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No unit types yet</h2>
          <p className="mt-1 text-sm text-slate-600">Create categories like "Standard", "Deluxe", "Suite" with base rates and occupancy.</p>
        </CardContent></Card>
      ) : (
        <UnitTypesTable types={types.map((t) => ({
          id: t.id, name: t.name, description: t.description,
          baseOccupancy: t.baseOccupancy, maxOccupancy: t.maxOccupancy,
          extraPersonFee: t.extraPersonFee ? Number(t.extraPersonFee) : null,
          bedType: t.bedType, bedCount: t.bedCount, bathroomCount: t.bathroomCount,
          unitCount: t._count.units,
        }))} currency={currency} />
      )}
    </div>
  );
}
