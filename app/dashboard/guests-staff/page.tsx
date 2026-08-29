import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { UserCog, Plus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaffTable } from '@/components/staff/staff-table';
import { InviteDialog } from '@/components/staff/invite-dialog';

export default async function StaffPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
    prisma.invitation.findMany({ where: { organizationId: orgId, acceptedAt: null }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff &amp; roles</h1>
          <p className="text-sm text-slate-600">Manage team members and invitations.</p>
        </div>
        <InviteDialog />
      </div>
      {users.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <UserCog className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No team members yet</h2>
        </CardContent></Card>
      ) : (
        <StaffTable
          users={users.map((u) => ({
            id: u.id, name: u.name, email: u.email, role: u.role,
            status: u.status, lastLoginAt: u.lastLoginAt?.toISOString() || null,
            createdAt: u.createdAt.toISOString(),
          }))}
          pendingInvites={pendingInvites.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt.toISOString() }))}
          currentUserId={session!.user.id}
        />
      )}
    </div>
  );
}
