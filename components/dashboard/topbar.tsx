'use client';

import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { LogOut, PanelLeftClose, PanelLeftOpen, Menu, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { NotificationBell } from './notification-bell';
import { useSidebar } from './sidebar-provider';

export function Topbar({
  user,
  organization,
}: {
  user: { name?: string | null; email: string; role?: string };
  organization: { name?: string };
}) {
  const [open, setOpen] = useState(false);
  const { collapsed, toggle, openMobile } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={openMobile}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:block"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border bg-white p-1 pr-3 hover:bg-slate-50 transition-colors"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px]">{getInitials(user.name || user.email)}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-medium text-slate-900">{user.name || 'Account'}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{user.role}</div>
            </div>
          </button>
          {open && (
            <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border bg-white shadow-xl">
              <div className="border-b px-3 py-2.5">
                <div className="text-xs font-medium text-slate-900">{user.name || 'Account'}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
              <div className="p-1">
                <a href="/dashboard/admin/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <User className="h-4 w-4" /> Profile & Settings
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
