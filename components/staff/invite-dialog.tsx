'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectHTML } from '@/components/ui/select-native';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2, Shield, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'properties', label: 'Properties' },
  { key: 'units', label: 'Units & Rooms' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'guests', label: 'Guests' },
  { key: 'rate-plans', label: 'Rate Plans' },
  { key: 'rates', label: 'Revenue Management' },
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

const ROLE_DEFAULTS: Record<string, string[]> = {
  ADMIN: ['dashboard','notifications','properties','units','bookings','guests','rate-plans','rates','calendar','housekeeping','maintenance','invoices','payments','expenses','guests-staff','reports','integrations','security','settings'],
  MANAGER: ['dashboard','notifications','properties','units','bookings','guests','rate-plans','rates','calendar','housekeeping','maintenance','invoices','payments','expenses','reports'],
  RECEPTIONIST: ['dashboard','notifications','units','bookings','guests','calendar','housekeeping'],
  HOUSEKEEPER: ['dashboard','notifications','units','calendar','housekeeping'],
  ACCOUNTANT: ['dashboard','notifications','invoices','payments','expenses','reports'],
};

export function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [role, setRole] = useState('RECEPTIONIST');
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [useCustom, setUseCustom] = useState(false);

  function handleRoleChange(newRole: string) {
    setRole(newRole);
    if (!useCustom) {
      setPermissions(null);
    }
  }

  function toggleSection(section: string) {
    if (permissions === null) {
      const defaults = ROLE_DEFAULTS[role] || [];
      setPermissions(defaults.filter((s) => s !== section));
    } else if (permissions.includes(section)) {
      const updated = permissions.filter((s) => s !== section);
      setPermissions(updated.length > 0 ? updated : null);
    } else {
      setPermissions([...permissions, section]);
    }
  }

  function selectAll() {
    setPermissions(null);
    setUseCustom(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body: any = { email: form.get('email'), role };
    if (useCustom && permissions !== null) {
      body.permissions = permissions;
    }
    const res = await fetch('/api/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    setLink(data.acceptUrl);
    toast.success('Invitation created');
    router.refresh();
  }

  const activePermissions = useCustom ? permissions : (ROLE_DEFAULTS[role] || null);
  const permCount = activePermissions ? activePermissions.length : SECTIONS.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setLink(null); setUseCustom(false); setPermissions(null); } }}>
      <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" /> Invite member</Button></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Invite member</DialogTitle></DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Share this link with your new team member. It expires in 7 days.</p>
            <div className="rounded-md border bg-slate-50 p-3 text-sm font-mono break-all">{link}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>Copy</Button>
              <Button onClick={() => { setOpen(false); setLink(null); }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required placeholder="staff@hotel.com" /></div>
            <div className="space-y-1.5"><Label htmlFor="role">Role</Label>
              <SelectHTML id="role" value={role} onChange={(e) => handleRoleChange(e.target.value)}>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="HOUSEKEEPER">Housekeeper</option>
                <option value="ACCOUNTANT">Accountant</option>
              </SelectHTML>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Section Access</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{permCount}/{SECTIONS.length}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={selectAll} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${!useCustom ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Role default</button>
                    <button type="button" onClick={() => { setUseCustom(true); if (permissions === null) setPermissions(ROLE_DEFAULTS[role] || []); }} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${useCustom ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Custom</button>
                  </div>
                </div>
              </div>
              {useCustom && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SECTIONS.map((s) => {
                    const isChecked = permissions !== null && permissions.includes(s.key);
                    return (
                      <label
                        key={s.key}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-all ${
                          isChecked ? 'border-slate-300 bg-slate-50 text-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-400'
                        } cursor-pointer hover:bg-slate-50`}
                      >
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isChecked ? 'border-slate-500 bg-slate-900 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        {s.label}
                      </label>
                    );
                  })}
                </div>
              )}
              {!useCustom && (
                <p className="text-xs text-slate-500">Member will get all {permCount} sections allowed by their role. Switch to Custom to restrict access.</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create invitation</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
