'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Trash2, Mail, X } from 'lucide-react';
import { formatDateTime, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import toast from 'react-hot-toast';

type User = { id: string; name: string | null; email: string; role: string; status: string; lastLoginAt: string | null; createdAt: string };
type Invite = { id: string; email: string; role: string; createdAt: string };

const STATUS_COLORS: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-700', INVITED: 'bg-blue-100 text-blue-700', SUSPENDED: 'bg-red-100 text-red-700' };
const ROLE_LABELS: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', RECEPTIONIST: 'Receptionist', HOUSEKEEPER: 'Housekeeper', ACCOUNTANT: 'Accountant' };

export function StaffTable({ users, pendingInvites, currentUserId }: { users: User[]; pendingInvites: Invite[]; currentUserId: string }) {
  const router = useRouter();

  async function changeRole(id: string, role: string) {
    const res = await fetch(`/api/staff/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Role updated');
    router.refresh();
  }
  async function removeUser(id: string) {
    if (!confirm('Remove this user from the workspace?')) return;
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Removed');
    router.refresh();
  }
  async function revokeInvite(id: string) {
    if (!confirm('Revoke this invitation?')) return;
    const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Revoked');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Last login</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(u.name || u.email)}</AvatarFallback></Avatar>
                    <div>
                      <div className="font-medium text-slate-900">{u.name || '—'}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {u.id === currentUserId ? (
                    <span className="text-sm">{ROLE_LABELS[u.role] || u.role}</span>
                  ) : (
                    <SelectHTML defaultValue={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="h-8 w-36">
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </SelectHTML>
                  )}
                </td>
                <td className="px-3 py-2"><Badge className={STATUS_COLORS[u.status]}>{u.status.toLowerCase()}</Badge></td>
                <td className="px-3 py-2 text-slate-500 text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                <td className="px-3 py-2 text-right">
                  {u.id !== currentUserId && (
                    <Button variant="ghost" size="icon" onClick={() => removeUser(u.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {pendingInvites.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4" /> Pending invitations
          </div>
          <div className="space-y-2">
            {pendingInvites.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
                <div>
                  <div className="text-sm font-medium">{i.email}</div>
                  <div className="text-xs text-slate-500">{ROLE_LABELS[i.role]} · sent {formatDateTime(i.createdAt)}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => revokeInvite(i.id)}><X className="h-4 w-4 text-red-600" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
