import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeasonalRatesTable } from '@/components/rate-plans/seasonal-rates-table';
import { RestrictionsTable } from '@/components/rate-plans/restrictions-table';
import Link from 'next/link';

export default async function RateManagementPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [seasonal, restrictions, ratePlans, properties] = await Promise.all([
    prisma.seasonalRate.findMany({ where: { organizationId: orgId }, include: { }, orderBy: { startDate: 'asc' } }),
    prisma.rateRestriction.findMany({ where: { organizationId: orgId }, orderBy: { startDate: 'asc' } }),
    prisma.ratePlan.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  // Enrich seasonal rates with rate plan name
  const rpMap = new Map(ratePlans.map((r) => [r.id, r.name]));
  const propMap = new Map(properties.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rate &amp; revenue management</h1>
          <p className="text-sm text-slate-600">Seasonal pricing, restrictions and revenue optimization.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/dashboard/revenue/rate-plans">Rate plans</Link></Button>
        </div>
      </div>
      <Tabs defaultValue="seasonal">
        <TabsList>
          <TabsTrigger value="seasonal">Seasonal pricing</TabsTrigger>
          <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
        </TabsList>
        <TabsContent value="seasonal">
          <SeasonalRatesTable
            rates={seasonal.map((s) => ({
              id: s.id, name: s.name, ratePlanId: s.ratePlanId, ratePlanName: rpMap.get(s.ratePlanId) || '—',
              propertyName: s.propertyId ? propMap.get(s.propertyId) || null : null,
              startDate: s.startDate.toISOString(), endDate: s.endDate.toISOString(),
              price: Number(s.price), currency: s.currency, priority: s.priority, isActive: s.isActive,
            }))}
            ratePlans={ratePlans.map((r) => ({ id: r.id, name: r.name }))}
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          />
        </TabsContent>
        <TabsContent value="restrictions">
          <RestrictionsTable
            restrictions={restrictions.map((r) => ({
              id: r.id, restrictionType: r.restrictionType, startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString(),
              minLOS: r.minLOS, maxLOS: r.maxLOS, closedToArrival: r.closedToArrival, closedToDeparture: r.closedToDeparture,
              minAdvance: r.minAdvance, maxAdvance: r.maxAdvance, isActive: r.isActive,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
