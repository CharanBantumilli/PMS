import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RatePlansTable } from '@/components/rate-plans/rate-plans-table';
import { RatePlanDialog } from '@/components/rate-plans/rate-plan-dialog';

export default async function RatePlansPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [plans, properties, org] = await Promise.all([
    prisma.ratePlan.findMany({ where: { organizationId: orgId }, include: { property: true, _count: { select: { bookings: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rate plans</h1>
          <p className="text-sm text-slate-600">Base rates, seasonal pricing and meal plans.</p>
        </div>
        <RatePlanDialog mode="create" properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
      {plans.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Tag className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No rate plans yet</h2>
        </CardContent></Card>
      ) : (
        <RatePlansTable plans={plans.map((p) => ({
          id: p.id, name: p.name, description: p.description,
          basePrice: Number(p.basePrice), isRefundable: p.isRefundable,
          minStay: p.minStay, maxStay: p.maxStay, mealsIncluded: p.mealsIncluded, isActive: p.isActive,
          property: p.property ? { name: p.property.name } : null,
          bookingCount: p._count.bookings,
        }))} properties={properties.map((p) => ({ id: p.id, name: p.name }))} currency={org?.currency || 'INR'} />
      )}
    </div>
  );
}
