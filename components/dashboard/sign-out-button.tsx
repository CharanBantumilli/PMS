'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className={className ?? 'mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 underline'}
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
}
