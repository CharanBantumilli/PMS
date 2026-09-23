import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GuestForm } from '@/components/guests/guest-form';
import Link from 'next/link';

export default function NewGuestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/dashboard/reservations/guests" className="hover:text-slate-900">← Back to guests</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>New guest</CardTitle></CardHeader>
        <CardContent><GuestForm mode="create" /></CardContent>
      </Card>
    </div>
  );
}
