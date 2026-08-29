'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, Calendar, Users, BedDouble,
  CreditCard, Receipt, Sparkles, Wrench, UserCog, BarChart3,
  Settings, LogOut, Hotel, ConciergeBell, Tag, Globe, Plug, Shield, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER','ACCOUNTANT'] },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER','ACCOUNTANT'] },
  { href: '/dashboard/properties', label: 'Properties', icon: Building2, roles: ['OWNER','ADMIN','MANAGER'] },
  { href: '/dashboard/units', label: 'Units & Rooms', icon: BedDouble, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'] },
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST'] },
  { href: '/dashboard/guests', label: 'Guests', icon: Users, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','ACCOUNTANT'] },
  { href: '/dashboard/rate-plans', label: 'Rate Plans', icon: Tag, roles: ['OWNER','ADMIN','MANAGER'] },
  { href: '/dashboard/rates', label: 'Revenue Mgmt', icon: BarChart3, roles: ['OWNER','ADMIN','MANAGER'] },
  { href: '/dashboard/calendar', label: 'Calendar', icon: ConciergeBell, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'] },
  { href: '/dashboard/channels', label: 'Channels', icon: Globe, roles: ['OWNER','ADMIN','MANAGER'] },
  { href: '/dashboard/housekeeping', label: 'Housekeeping', icon: Sparkles, roles: ['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER'] },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench, roles: ['OWNER','ADMIN','MANAGER'] },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt, roles: ['OWNER','ADMIN','MANAGER','ACCOUNTANT'] },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard, roles: ['OWNER','ADMIN','MANAGER','ACCOUNTANT'] },
  { href: '/dashboard/expenses', label: 'Expenses', icon: CreditCard, roles: ['OWNER','ADMIN','ACCOUNTANT'] },
  { href: '/dashboard/guests-staff', label: 'Staff', icon: UserCog, roles: ['OWNER','ADMIN'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER','ADMIN','MANAGER','ACCOUNTANT'] },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug, roles: ['OWNER','ADMIN'] },
  { href: '/dashboard/security', label: 'Security', icon: Shield, roles: ['OWNER','ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['OWNER','ADMIN','MANAGER'] },
];

export function Sidebar({ organizationName, organizationId, role }: { organizationName: string; organizationId: string; role: string }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Hotel className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{organizationName}</div>
          <div className="truncate text-xs text-slate-500">PMS Workspace</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
