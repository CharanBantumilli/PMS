import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MaintenanceList } from '@/components/maintenance/maintenance-list';
import { MaintenanceDialog } from '@/components/maintenance/maintenance-dialog';

export default async function MaintenancePage({ searchParams }: { searchParams: { unitId?: string; status?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId };
  if (searchParams.unitId) where.unitId = searchParams.unitId;
  if (searchParams.status) where.status = searchParams.status;
  const [tickets, units, staff, org] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where, include: { unit: { include: { property: true } }, assignee: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 200,
    }),
    prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { number: 'asc' }, include: { property: true } }),
    prisma.user.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);
  const STATUSES = ['', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETED', 'CANCELED'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-600">Track repairs, service requests and capital projects.</p>
        </div>
        <MaintenanceDialog mode="create" units={units.map((u) => ({ id: u.id, number: u.number, name: u.name, property: u.property.name }))} staff={staff.map((s) => ({ id: s.id, name: s.name || s.email }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <a key={s || 'all'} href={s ? `/dashboard/maintenance?status=${s}` : '/dashboard/maintenance'} className={`rounded-full border px-3 py-1 text-xs font-medium ${(searchParams.status || '') === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{s ? s.replace('_',' ').toLowerCase() : 'All'}</a>
        ))}
      </div>
      {tickets.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Wrench className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No maintenance tickets</h2>
        </CardContent></Card>
      ) : (
        <MaintenanceList tickets={tickets.map((t) => ({
          id: t.id, title: t.title, description: t.description,
          priority: t.priority, status: t.status, category: t.category,
          estimatedCost: t.estimatedCost ? Number(t.estimatedCost) : null,
          actualCost: t.actualCost ? Number(t.actualCost) : null,
          scheduledFor: t.scheduledFor?.toISOString() || null,
          completedAt: t.completedAt?.toISOString() || null,
          unit: { id: t.unit.id, number: t.unit.number, name: t.unit.name },
          property: { name: t.unit.property.name },
          assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name || t.assignee.email } : null,
        }))} currency={org?.currency || 'INR'} />
      )}
    </div>
  );
}
