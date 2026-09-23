'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDateTime, statusLabel } from '@/lib/utils';
import { useState } from 'react';

type Activity = { id: string; action: string; entity: string; entityId: string | null; description: string; user: { name: string | null; email: string } | null; createdAt: string };

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
  INVITE: 'bg-amber-100 text-amber-700',
  CHECK_IN: 'bg-emerald-100 text-emerald-700',
  CHECK_OUT: 'bg-slate-100 text-slate-700',
  PAYMENT_RECEIVED: 'bg-emerald-100 text-emerald-700',
  INVOICE_SENT: 'bg-blue-100 text-blue-700',
};

export function AuditLog({ activities }: { activities: Activity[] }) {
  const [search, setSearch] = useState('');
  const filtered = activities.filter((a) =>
    !search || a.description.toLowerCase().includes(search.toLowerCase()) || a.entity.toLowerCase().includes(search.toLowerCase()) || (a.user?.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Input placeholder="Search by description, entity or user…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
      <div className="divide-y rounded-md border bg-white max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No matching events</div>
        ) : filtered.map((a) => (
          <div key={a.id} className="flex items-start gap-3 p-3 hover:bg-slate-50">
            <Badge className={ACTION_COLORS[a.action] || 'bg-slate-100 text-slate-700'}>{statusLabel(a.action)}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-900">{a.description}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {a.user ? `${a.user.name || a.user.email} · ` : ''}{a.entity} · {formatDateTime(a.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
