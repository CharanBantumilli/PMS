'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getInitials } from '@/lib/utils';
import { Star, Mail, Phone } from 'lucide-react';

type Guest = {
  id: string; firstName: string; lastName: string; email: string | null; phone: string | null;
  country: string | null; vipLevel: number; totalStays: number; totalSpent: number;
};

export function GuestsTable({ guests, currency = 'USD' }: { guests: Guest[]; currency?: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {guests.map((g) => (
        <Link key={g.id} href={`/dashboard/guests/${g.id}`} className="block">
          <Card className="p-4 transition hover:shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                {getInitials(`${g.firstName} ${g.lastName}`)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium text-slate-900">{g.firstName} {g.lastName}</div>
                  {g.vipLevel > 0 && (
                    <Badge variant="warning" className="gap-0.5"><Star className="h-3 w-3" /> VIP {g.vipLevel}</Badge>
                  )}
                </div>
                {g.email && <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3 w-3" /> <span className="truncate">{g.email}</span></div>}
                {g.phone && <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" /> {g.phone}</div>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{g.totalStays} stay{g.totalStays !== 1 ? 's' : ''}</span>
              <span className="font-medium text-slate-700">{formatCurrency(g.totalSpent, currency)}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
