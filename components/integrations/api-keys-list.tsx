'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Key, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; expiresAt: string | null; isActive: boolean; createdAt: string };

export function ApiKeysList({ keys }: { keys: ApiKey[] }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<string | null>(null);

  async function remove(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/api-keys/${k.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Revoked');
    router.refresh();
  }

  async function toggle(k: ApiKey) {
    const res = await fetch(`/api/api-keys/${k.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !k.isActive }) });
    if (!res.ok) { toast.error('Failed'); return; }
    router.refresh();
  }

  return (
    <Card>
      {keys.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">No API keys yet. Create one to access the REST API.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Key</th>
              <th className="px-3 py-3">Scopes</th>
              <th className="px-3 py-3">Last used</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{k.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {revealed === k.id ? 'pms_live_••••••••••••' : k.prefix + '••••••••••••'}
                  <button onClick={() => setRevealed(revealed === k.id ? null : k.id)} className="ml-1 text-slate-400 hover:text-slate-600">
                    {revealed === k.id ? <EyeOff className="inline h-3 w-3" /> : <Eye className="inline h-3 w-3" />}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {k.scopes.length === 0 ? <span className="text-xs text-slate-500">Full access</span> : k.scopes.map((s) => <Badge key={s} variant="outline" className="mr-1 text-[10px]">{s}</Badge>)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : 'Never'}</td>
                <td className="px-3 py-2"><Badge variant={k.isActive ? 'success' : 'secondary'}>{k.isActive ? 'Active' : 'Disabled'}</Badge></td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggle(k)}>{k.isActive ? 'Disable' : 'Enable'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(k)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
