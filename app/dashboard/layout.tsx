import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { SidebarProvider } from '@/components/dashboard/sidebar-provider';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { PermissionGuard } from '@/components/dashboard/permission-guard';

function getSectionKey(pathname: string): string {
  const stripped = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  return stripped || 'dashboard';
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const org = session.user.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { id: true, name: true, slug: true, brandName: true, logo: true, primaryColor: true },
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

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { permissions: true, role: true },
  });

  const userPermissions = currentUser ? (currentUser.permissions as string[] | null) : session.user.permissions;
  const userRole = currentUser?.role || session.user.role || 'STAFF';

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar
          organizationName={org?.brandName || org?.name || 'Workspace'}
          organizationId={org?.id || ''}
          logo={org?.logo || null}
          role={userRole}
          permissions={userPermissions}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
            organization={{ name: org?.name }}
          />
          <main className="flex-1 overflow-y-auto p-6">
            <PermissionGuard role={userRole} permissions={userPermissions}>
              {children}
            </PermissionGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
