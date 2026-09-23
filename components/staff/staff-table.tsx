'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Trash2, X, ChevronDown, ChevronRight, Shield, ShieldOff, Users } from 'lucide-react';
import { formatDateTime, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import toast from 'react-hot-toast';

type User = { id: string; name: string | null; email: string; role: string; status: string; lastLoginAt: string | null; createdAt: string; permissions: string[] | null };
type Invite = { id: string; email: string; role: string; createdAt: string };

const STATUS_COLORS: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-700', INVITED: 'bg-blue-100 text-blue-700', SUSPENDED: 'bg-red-100 text-red-700', PENDING_VERIFICATION: 'bg-amber-100 text-amber-700' };
const ROLE_LABELS: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', RECEPTIONIST: 'Receptionist', HOUSEKEEPER: 'Housekeeper', ACCOUNTANT: 'Accountant' };

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'properties', label: 'Properties' },
  { key: 'units', label: 'Units & Rooms' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'guests', label: 'Guests' },
  { key: 'rate-plans', label: 'Rate Plans' },
  { key: 'rates', label: 'Revenue Mgmt' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'guests-staff', label: 'Staff' },
  { key: 'reports', label: 'Reports' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'security', label: 'Security' },
  { key: 'settings', label: 'Settings' },
];

export function StaffTable({ users, pendingInvites, currentUserId, currentUserRole }: { users: User[]; pendingInvites: Invite[]; currentUserId: string; currentUserRole: string }) {
  const router = useRouter();
  const canManagePermissions = ['OWNER', 'ADMIN'].includes(currentUserRole);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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
  async function updatePermissions(id: string, permissions: string[] | null) {
    const res = await fetch(`/api/staff/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ permissions }) });
    if (!res.ok) { toast.error('Failed to update permissions'); return; }
    toast.success('Permissions updated');
    window.dispatchEvent(new Event('permissions-updated'));
    router.refresh();
  }

  function toggleSection(userId: string, currentPermissions: string[] | null, section: string) {
    let updated: string[];
    if (currentPermissions === null) {
      updated = SECTIONS.filter((s) => s.key !== section).map((s) => s.key);
    } else if (currentPermissions.includes(section)) {
      updated = currentPermissions.filter((s) => s !== section);
    } else {
      updated = [...currentPermissions, section];
    }
    updatePermissions(userId, updated.length > 0 ? updated : null);
  }

  function giveFullAccess(userId: string) {
    updatePermissions(userId, null);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const isExpanded = expandedUser === u.id;
                const isOwner = u.role === 'OWNER';
                const hasCustomPermissions = u.permissions !== null;
                const accessLabel = isOwner || u.role === 'ADMIN' ? 'Full access' : hasCustomPermissions ? `${u.permissions!.length} of ${SECTIONS.length} sections` : 'Role-based';
                const showAccessToggle = canManagePermissions && u.id !== currentUserId && !isOwner;

                return (
                  <tr key={u.id} className="group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{getInitials(u.name || u.email)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{u.name || '—'}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.id === currentUserId || isOwner ? (
                        <span className="text-sm text-slate-700">{ROLE_LABELS[u.role] || u.role}</span>
                      ) : (
                        <SelectHTML defaultValue={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="h-8 w-36">
                          {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'OWNER').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </SelectHTML>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge className={STATUS_COLORS[u.status]}>{u.status.toLowerCase()}</Badge></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {showAccessToggle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                            className={isExpanded ? 'bg-slate-100' : ''}
                          >
                            {isExpanded ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            <span className="ml-1 hidden sm:inline">{isExpanded ? 'Hide' : 'Access'}</span>
                          </Button>
                        )}
                        {u.id !== currentUserId && !isOwner && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeUser(u.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {users.filter((u) => expandedUser === u.id).map((u) => {
          const perms = u.permissions;
          return (
            <div key={`perms-${u.id}`} className="border-t bg-slate-50/50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Shield className="h-4 w-4 text-slate-500" />
                  Section access for {u.name || u.email}
                </div>
                <Button variant="outline" size="sm" onClick={() => giveFullAccess(u.id)}>
                  Grant full access
                </Button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {perms === null ? 'Using role-based defaults. Toggle sections below to customize.' : `Custom access: ${perms.length} of ${SECTIONS.length} sections.`}
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {SECTIONS.map((s) => {
                  const isChecked = perms === null || perms.includes(s.key);
                  return (
                    <label
                      key={s.key}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        isChecked ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-400'
                      } cursor-pointer hover:bg-slate-50`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSection(u.id, perms, s.key)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {s.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      {pendingInvites.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-slate-500" /> Pending invitations
          </div>
          <div className="space-y-2">
            {pendingInvites.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md border bg-slate-50 p-3">
                <div>
                  <div className="text-sm font-medium">{i.email}</div>
                  <div className="text-xs text-slate-500">{ROLE_LABELS[i.role]} · sent {formatDateTime(i.createdAt)}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => revokeInvite(i.id)}><X className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
