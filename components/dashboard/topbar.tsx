'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from './notification-bell';

export function Topbar({
  user,
  organization,
}: {
  user: { name?: string | null; email: string; role?: string };
  organization: { name?: string; plan?: string; planStatus?: string; trialEndsAt?: Date | null };
}) {
  const [open, setOpen] = useState(false);
  const trialDaysLeft = organization.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-slate-900">{organization.name || 'Dashboard'}</h1>
        {organization.planStatus === 'TRIAL' && trialDaysLeft > 0 && (
          <Badge variant="warning">Trial · {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border bg-white p-1 pr-3 hover:bg-slate-50"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="text-xs font-medium text-slate-900">{user.name || 'Account'}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{user.role}</div>
            </div>
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-56 rounded-md border bg-white p-1 shadow-lg">
              <div className="border-b px-3 py-2 text-xs text-slate-500">{user.email}</div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
