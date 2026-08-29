'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Globe, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

type Session = { id: string; ipAddress: string | null; userAgent: string | null; device: string | null; location: string | null; isActive: boolean; lastActiveAt: string; createdAt: string };

export function SessionsList({ sessions, currentSessionId }: { sessions: Session[]; currentSessionId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function revoke(id: string) {
    if (!confirm('Revoke this session?')) return;
    setBusy(id);
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Session revoked');
    router.refresh();
  }

  async function revokeAll() {
    if (!confirm('Revoke all other sessions?')) return;
    setBusy('all');
    await Promise.all(sessions.filter((s) => s.id !== currentSessionId).map((s) => fetch(`/api/sessions/${s.id}`, { method: 'DELETE' })));
    setBusy(null);
    toast.success('All sessions revoked');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {sessions.length > 1 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={revokeAll} disabled={busy === 'all'}>Revoke all other sessions</Button>
        </div>
      )}
      {sessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No active sessions</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isMobile = /mobile|android|iphone/i.test(s.userAgent || '');
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    {isMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{s.device || (isMobile ? 'Mobile device' : 'Desktop')}</h3>
                      {s.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Revoked</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-2">
                      {s.location && <span><Globe className="inline h-3 w-3" /> {s.location}</span>}
                      {s.ipAddress && <span>· {s.ipAddress}</span>}
                      <span>· Last active {formatDateTime(s.lastActiveAt)}</span>
                    </div>
                  </div>
                  {s.isActive && s.id !== currentSessionId && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(s.id)} disabled={busy === s.id}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
