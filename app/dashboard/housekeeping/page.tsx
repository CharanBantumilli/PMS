import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HousekeepingBoard } from '@/components/housekeeping/housekeeping-board';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export default async function HousekeepingPage({ searchParams }: { searchParams: { unitId?: string; propertyId?: string; status?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId };
  if (searchParams.unitId) where.unitId = searchParams.unitId;
  if (searchParams.propertyId) where.propertyId = searchParams.propertyId;
  if (searchParams.status) where.status = searchParams.status;

  const [tasks, properties, units, staff] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where, include: { unit: { include: { property: true } }, assignee: true, booking: { include: { guest: true } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { scheduledFor: 'asc' }],
      take: 200,
    }),
    prisma.property.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { number: 'asc' }, take: 500 }),
    prisma.user.findMany({ where: { organizationId: orgId, role: { in: ['HOUSEKEEPER','RECEPTIONIST','MANAGER','ADMIN','OWNER'] } }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Housekeeping</h1>
          <p className="text-sm text-slate-600">Live task board for cleaning, turndown and inspection.</p>
        </div>
      </div>
      {tasks.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No housekeeping tasks</h2>
          <p className="mt-1 text-sm text-slate-600">Tasks are auto-generated from bookings. Create one manually if needed.</p>
        </CardContent></Card>
      ) : (
        <HousekeepingBoard
          tasks={tasks.map((t) => ({
            id: t.id, type: t.type, status: t.status, priority: t.priority,
            notes: t.notes, scheduledFor: t.scheduledFor?.toISOString() || null,
            startedAt: t.startedAt?.toISOString() || null, completedAt: t.completedAt?.toISOString() || null,
            unit: { id: t.unit.id, number: t.unit.number, name: t.unit.name },
            property: { name: t.unit.property.name },
            assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name || t.assignee.email } : null,
            booking: t.booking ? { confirmationCode: t.booking.confirmationCode, guest: `${t.booking.guest.firstName} ${t.booking.guest.lastName}` } : null,
          }))}
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          units={units.map((u) => ({ id: u.id, number: u.number, name: u.name, propertyId: u.propertyId }))}
          staff={staff.map((s) => ({ id: s.id, name: s.name || s.email }))}
          activePropertyId={searchParams.propertyId}
        />
      )}
    </div>
  );
}
