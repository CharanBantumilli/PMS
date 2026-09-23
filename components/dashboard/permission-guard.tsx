'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTION_KEY_MAP: Record<string, string> = {
  reservations: 'reservations',
  properties: 'properties',
  units: 'units',
  operations: 'operations',
  housekeeping: 'housekeeping',
  maintenance: 'maintenance',
  finance: 'finance',
  payments: 'payments',
  invoices: 'invoices',
  expenses: 'expenses',
  revenue: 'revenue',
  'rate-plans': 'rate-plans',
  rates: 'rates',
  staff: 'guests-staff',
  admin: 'admin',
  settings: 'settings',
  security: 'security',
  integrations: 'integrations',
  notifications: 'notifications',
};

function getSectionKey(pathname: string): string {
  const stripped = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  return SECTION_KEY_MAP[stripped] || stripped || 'dashboard';
}

export function PermissionGuard({ role: initialRole, permissions: initialPermissions, children }: { role: string; permissions: string[] | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    setChecking(true);
    fetch('/api/user/permissions', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!active) return;
        if (data) {
          setRole(data.role);
          setPermissions(data.permissions);
        }
        setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [pathname]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (['OWNER', 'ADMIN'].includes(role) || permissions === null) {
    return <>{children}</>;
  }

  const section = getSectionKey(pathname);
  if (permissions.includes(section)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldX className="h-16 w-16 text-red-400" />
      <h2 className="mt-4 text-xl font-semibold text-slate-900">Access Denied</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        You don&apos;t have permission to access <span className="font-medium text-slate-700">{section.replace(/-/g, ' ')}</span>. Contact your workspace owner to request access.
      </p>
      <Button className="mt-6" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
    </div>
  );
}
