import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { InviteAcceptForm } from '@/components/staff/invite-accept-form';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const inv = await prisma.invitation.findUnique({ where: { token: params.token }, include: { organization: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Invitation invalid</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">This invitation link is no longer valid. Please ask your administrator to send a new one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white"><Building2 className="h-4 w-4" /></div>
            <span className="font-bold">PMS</span>
          </div>
          <CardTitle>Join {inv.organization.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">You've been invited as <span className="font-semibold">{inv.role}</span>. Create your account to accept.</p>
          <InviteAcceptForm token={params.token} email={inv.email} />
        </CardContent>
      </Card>
    </div>
  );
}
