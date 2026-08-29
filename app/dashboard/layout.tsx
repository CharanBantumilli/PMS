import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { SignOutButton } from '@/components/dashboard/sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const org = session.user.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { id: true, name: true, slug: true, brandName: true, logo: true, primaryColor: true, plan: true, planStatus: true, trialEndsAt: true },
      })
    : null;
  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">No workspace</h1>
          <p className="mt-2 text-sm text-slate-600">Your account isn&apos;t linked to a workspace. Please contact your administrator.</p>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        organizationName={org?.brandName || org?.name || 'Workspace'}
        organizationId={org?.id || ''}
        role={session.user.role || 'STAFF'}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
          organization={{ name: org?.name, plan: org?.plan, planStatus: org?.planStatus, trialEndsAt: org?.trialEndsAt }}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
