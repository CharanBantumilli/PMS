import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { GuestsTable } from '@/components/guests/guests-table';

export default async function GuestsPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const where: any = { organizationId: orgId, deletedAt: null };
  if (searchParams.q) {
    where.OR = [
      { firstName: { contains: searchParams.q, mode: 'insensitive' } },
      { lastName: { contains: searchParams.q, mode: 'insensitive' } },
      { email: { contains: searchParams.q, mode: 'insensitive' } },
      { phone: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }
  const [guests, org] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 300,
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Guests</h1>
          <p className="text-sm text-slate-600">Unified guest CRM with stay history, preferences and contact info.</p>
        </div>
        <Button asChild><Link href="/dashboard/reservations/guests/new"><Plus className="h-4 w-4" /> New guest</Link></Button>
      </div>
      <form className="max-w-md">
        <input name="q" defaultValue={searchParams.q} placeholder="Search name, email, phone…" className="h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </form>
      {guests.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No guests yet</h2>
          <p className="mt-1 text-sm text-slate-600">Add your first guest to start building your CRM.</p>
          <Button asChild className="mt-4"><Link href="/dashboard/reservations/guests/new">Add guest</Link></Button>
        </CardContent></Card>
      ) : (
        <GuestsTable currency={org?.currency || 'INR'} guests={guests.map((g) => ({
          id: g.id,
          firstName: g.firstName, lastName: g.lastName,
          email: g.email, phone: g.phone, country: g.country, vipLevel: g.vipLevel,
          idType: g.idType, idNumber: g.idNumber,
          totalStays: g.totalStays, totalSpent: Number(g.totalSpent),
        }))} />
      )}
    </div>
  );
}
