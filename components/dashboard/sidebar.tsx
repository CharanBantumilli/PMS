'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, Calendar, Users, BedDouble,
  CreditCard, Receipt, Sparkles, Wrench, UserCog, BarChart3,
  Settings, LogOut, Hotel, ConciergeBell, Tag, Plug, Shield, Bell, Wallet, TrendingUp,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { useSidebar } from './sidebar-provider';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  permissionKey?: string;
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  roles: string[];
  items: NavItem[];
  permissionKey?: string;
};

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

const ALL_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'ACCOUNTANT'];

const NAV: NavEntry[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES },

  {
    label: 'Reservations', icon: Calendar, roles: ALL_ROLES,
    items: [
      { href: '/dashboard/reservations/calendar', label: 'Calendar', icon: ConciergeBell, roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'], permissionKey: 'calendar' },
      { href: '/dashboard/reservations/bookings', label: 'Bookings', icon: Calendar, roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'], permissionKey: 'bookings' },
      { href: '/dashboard/reservations/guests', label: 'Guests', icon: Users, roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'], permissionKey: 'guests' },
    ],
  },

  {
    label: 'Properties', icon: Building2, roles: ALL_ROLES,
    items: [
      { href: '/dashboard/properties', label: 'Properties', icon: Building2, roles: ['OWNER', 'ADMIN', 'MANAGER'], permissionKey: 'properties' },
      { href: '/dashboard/properties/units', label: 'Units & Rooms', icon: BedDouble, roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'], permissionKey: 'units' },
    ],
  },

  {
    label: 'Operations', icon: Sparkles, roles: ALL_ROLES,
    items: [
      { href: '/dashboard/operations/housekeeping', label: 'Housekeeping', icon: Sparkles, roles: ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER'], permissionKey: 'housekeeping' },
      { href: '/dashboard/operations/maintenance', label: 'Maintenance', icon: Wrench, roles: ['OWNER', 'ADMIN', 'MANAGER'], permissionKey: 'maintenance' },
    ],
  },

  {
    label: 'Finance', icon: CreditCard, roles: ALL_ROLES,
    items: [
      { href: '/dashboard/finance/payments', label: 'Payments', icon: CreditCard, roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'], permissionKey: 'payments' },
      { href: '/dashboard/finance/invoices', label: 'Invoices', icon: Receipt, roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'], permissionKey: 'invoices' },
      { href: '/dashboard/finance/expenses', label: 'Expenses', icon: Wallet, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], permissionKey: 'expenses' },
    ],
  },

  {
    label: 'Revenue', icon: TrendingUp, roles: ['OWNER', 'ADMIN', 'MANAGER'],
    items: [
      { href: '/dashboard/revenue/rate-plans', label: 'Rate Plans', icon: Tag, roles: ['OWNER', 'ADMIN', 'MANAGER'], permissionKey: 'rate-plans' },
      { href: '/dashboard/revenue/rates', label: 'Revenue Management', icon: TrendingUp, roles: ['OWNER', 'ADMIN', 'MANAGER'], permissionKey: 'rates' },
    ],
  },

  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { href: '/dashboard/staff', label: 'Staff', icon: UserCog, roles: ['OWNER', 'ADMIN'], permissionKey: 'guests-staff' },

  {
    label: 'Administration', icon: Settings, roles: ['OWNER', 'ADMIN', 'MANAGER'],
    items: [
      { href: '/dashboard/admin/settings', label: 'Settings', icon: Settings, roles: ['OWNER', 'ADMIN', 'MANAGER'], permissionKey: 'settings' },
      { href: '/dashboard/admin/security', label: 'Security', icon: Shield, roles: ['OWNER', 'ADMIN'], permissionKey: 'security' },
      { href: '/dashboard/admin/integrations', label: 'Integrations', icon: Plug, roles: ['OWNER', 'ADMIN'], permissionKey: 'integrations' },
      { href: '/dashboard/admin/notifications', label: 'Notifications', icon: Bell, roles: ALL_ROLES, permissionKey: 'notifications' },
    ],
  },
];

function itemHasAccess(item: NavItem, role: string, permissions: string[] | null | undefined): boolean {
  const isFullAccess = ['OWNER', 'ADMIN'].includes(role) || permissions === null || permissions === undefined;
  if (!item.roles.includes(role)) return false;
  if (isFullAccess) return true;
  const key = item.permissionKey || item.href.replace('/dashboard', '').replace(/^\//, '') || 'dashboard';
  return permissions!.includes(key);
}

function SidebarContent({ organizationName, logo, collapsed }: { organizationName: string; logo: string | null; collapsed: boolean }) {
  const pathname = usePathname();
  const { closeMobile } = useSidebar();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<string>('');
  const [permissions, setPermissions] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/user/permissions', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setRole(data.role);
          setPermissions(data.permissions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function fetchPerms() {
      fetch('/api/user/permissions', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setRole(data.role);
            setPermissions(data.permissions);
          }
        })
        .catch(() => {});
    }
    window.addEventListener('permissions-updated', fetchPerms);
    return () => window.removeEventListener('permissions-updated', fetchPerms);
  }, []);

  const isItemActive = useCallback((href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  }, [pathname]);

  const toggleGroup = useCallback((label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  useEffect(() => {
    if (!role) return;
    const initial: Record<string, boolean> = {};
    for (const entry of NAV) {
      if (isGroup(entry)) {
        const anyActive = entry.items.some((item) => isItemActive(item.href));
        const groupVisible = entry.roles.includes(role);
        if (groupVisible && anyActive) {
          initial[entry.label] = true;
        }
      }
    }
    setExpanded((prev) => ({ ...prev, ...initial }));
  }, [pathname, role, isItemActive]);

  const visibleEntries = NAV.filter((entry) => {
    if (isGroup(entry)) {
      if (!entry.roles.includes(role)) return false;
      const visibleItems = entry.items.filter((item) => itemHasAccess(item, role, permissions));
      return visibleItems.length > 0;
    }
    return itemHasAccess(entry, role, permissions);
  });

  function renderEntry(entry: NavEntry) {
    if (!isGroup(entry)) {
      const active = isItemActive(entry.href);
      if (!itemHasAccess(entry, role, permissions)) return null;
      return (
        <Link
          key={entry.href}
          href={entry.href}
          onClick={closeMobile}
          title={collapsed ? entry.label : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-2',
            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          <entry.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{entry.label}</span>}
        </Link>
      );
    }

    const visibleItems = entry.items.filter((item) => itemHasAccess(item, role, permissions));
    if (visibleItems.length === 0) return null;

    const isExpanded = expanded[entry.label] ?? false;
    const anyChildActive = visibleItems.some((item) => isItemActive(item.href));
    const GroupIcon = entry.icon;

    if (collapsed) {
      return (
        <div key={entry.label} className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                title={item.label}
                className={cn(
                  'flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div key={entry.label} className="space-y-0.5">
        <button
          onClick={() => toggleGroup(entry.label)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            anyChildActive ? 'text-slate-900' : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          <GroupIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{entry.label}</span>
          {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}
        </button>
        {isExpanded && (
          <div className="ml-4 space-y-0.5 border-l pl-3">
            {visibleItems.map((item) => {
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn('flex h-16 items-center gap-2 border-b', collapsed ? 'justify-center px-2' : 'px-4')}>
        {logo ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border">
            <Image src={logo} alt={organizationName} width={36} height={36} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Hotel className="h-5 w-5" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{organizationName}</div>
            <div className="truncate text-xs text-slate-500">PMS Workspace</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {visibleEntries.map((entry) => renderEntry(entry))}
      </nav>

      <div className="border-t p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </>
  );
}

export function Sidebar({ organizationName, organizationId, logo, role, permissions: initialPermissions }: { organizationName: string; organizationId: string; logo?: string | null; role: string; permissions?: string[] | null }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();

  return (
    <>
      <aside className={cn(
        'hidden flex-col border-r bg-white transition-all duration-200 md:flex',
        collapsed ? 'w-[60px]' : 'w-64'
      )}>
        <SidebarContent organizationName={organizationName} logo={logo ?? null} collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={closeMobile} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-white transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent organizationName={organizationName} logo={logo ?? null} collapsed={false} />
      </aside>
    </>
  );
}
