import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, STATUS_COLORS, statusLabel } from '@/lib/utils';
import { GuestForm } from '@/components/guests/guest-form';

export default async function GuestDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const guest = await prisma.guest.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { bookings: { include: { property: true, unit: true }, orderBy: { arrivalDate: 'desc' }, take: 50 } },
  });
  if (!guest) notFound();
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
  const currency = org?.currency || 'INR';

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/guests" className="hover:text-slate-900">← Back to guests</Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{guest.firstName} {guest.lastName}</h1>
          <p className="text-sm text-slate-600">{guest.totalStays} stays · {formatCurrency(Number(guest.totalSpent), currency)} total spend</p>
        </div>
        <div className="flex gap-2">
          {guest.vipLevel > 0 && <Badge variant="warning">VIP {guest.vipLevel}</Badge>}
          <Button asChild><Link href={`/dashboard/bookings/new?guestId=${guest.id}`}>New booking for guest</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <GuestForm
              mode="edit"
              initial={{
                id: guest.id,
                firstName: guest.firstName, lastName: guest.lastName,
                email: guest.email, phone: guest.phone,
                address: guest.address, city: guest.city, country: guest.country,
                idType: guest.idType, idNumber: guest.idNumber,
                dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.toISOString().slice(0, 10) : null,
                nationality: guest.nationality,
                vipLevel: guest.vipLevel,
                marketingOptIn: guest.marketingOptIn,
                notes: guest.notes,
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stay history</CardTitle></CardHeader>
          <CardContent>
            {guest.bookings.length === 0 ? (
              <p className="text-sm text-slate-500">No prior bookings.</p>
            ) : (
              <div className="divide-y">
                {guest.bookings.map((b) => (
                  <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="block py-2 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{b.property.name}</div>
                        <div className="text-xs text-slate-500">{formatDate(b.arrivalDate)} → {formatDate(b.departureDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(Number(b.totalAmount), b.currency)}</div>
                        <Badge className={STATUS_COLORS[b.status]}>{statusLabel(b.status)}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
