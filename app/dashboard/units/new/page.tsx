import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewUnitButton } from '@/components/units/new-unit-button';
import Link from 'next/link';

export default async function NewUnitPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [properties, unitTypes] = await Promise.all([
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.unitTypeDefinition.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/units" className="hover:text-slate-900">← Back to units</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>New unit</CardTitle></CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-sm text-slate-600">You need to create a property first.</p>
          ) : (
            <div className="flex items-center justify-center py-12">
              <NewUnitButton
                properties={properties.map((p) => ({ id: p.id, name: p.name }))}
                unitTypes={unitTypes.map((t) => ({ id: t.id, name: t.name, basePrice: Number(t.basePrice) }))}
                defaultPropertyId={properties[0].id}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
