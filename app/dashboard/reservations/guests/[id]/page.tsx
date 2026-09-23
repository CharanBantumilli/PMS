import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, STATUS_COLORS, statusLabel } from '@/lib/utils';
import { GuestForm } from '@/components/guests/guest-form';
import { DeleteConfirm } from '@/components/ui/delete-confirm';
import { MaskedField } from '@/components/ui/masked-field';
import { FileText, ExternalLink, ShieldCheck } from 'lucide-react';

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
  const canDelete = ['OWNER', 'ADMIN'].includes(session!.user.role as string);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/reservations/guests" className="hover:text-slate-900">← Back to guests</Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{guest.firstName} {guest.lastName}</h1>
          <p className="text-sm text-slate-600">{guest.totalStays} stays · {formatCurrency(Number(guest.totalSpent), currency)} total spend</p>
        </div>
        <div className="flex gap-2">
          {guest.vipLevel > 0 && <Badge variant="warning">VIP {guest.vipLevel}</Badge>}
          <Button asChild><Link href={`/dashboard/reservations/bookings/new?guestId=${guest.id}`}>New booking for guest</Link></Button>
          {canDelete && <DeleteConfirm entityName={`${guest.firstName} ${guest.lastName}`} deleteUrl={`/api/guests/${guest.id}`} redirectUrl="/dashboard/reservations/guests" />}
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
                idType: guest.idType, idNumber: guest.idNumber, idDocumentUrl: guest.idDocumentUrl,
                dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.toISOString().slice(0, 10) : null,
                nationality: guest.nationality,
                vipLevel: guest.vipLevel,
                marketingOptIn: guest.marketingOptIn,
                notes: guest.notes,
              }}
            />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {/* Identity Card */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Identity</CardTitle></CardHeader>
            <CardContent>
              {guest.idType || guest.idNumber ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase">ID type</div>
                    <div className="text-sm font-medium text-slate-900">{guest.idType?.replace('_', ' ') || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase">ID number</div>
                    <div className="text-sm font-medium text-slate-900 font-mono tracking-wide"><MaskedField value={guest.idNumber} type="id" /></div>
                  </div>
                  {guest.idDocumentUrl && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase mb-1">Document</div>
                      {guest.idDocumentUrl.endsWith('.pdf') ? (
                        <a href={guest.idDocumentUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span className="flex-1 truncate">View PDF</span>
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </a>
                      ) : (
                        <a href={guest.idDocumentUrl} target="_blank" rel="noopener noreferrer"
                          className="block overflow-hidden rounded-md border">
                          <img src={guest.idDocumentUrl} alt="ID document" className="h-32 w-full object-cover" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No ID verification on file.</p>
              )}
            </CardContent>
          </Card>
          {/* Stay history */}
          <Card>
            <CardHeader><CardTitle>Stay history</CardTitle></CardHeader>
            <CardContent>
              {guest.bookings.length === 0 ? (
                <p className="text-sm text-slate-500">No prior bookings.</p>
              ) : (
                <div className="divide-y">
                  {guest.bookings.map((b) => (
                    <Link key={b.id} href={`/dashboard/reservations/bookings/${b.id}`} className="block py-2 hover:bg-slate-50">
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
    </div>
  );
}
