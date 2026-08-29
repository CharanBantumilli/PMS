'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectHTML } from '@/components/ui/select-native';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = { email: form.get('email'), role: form.get('role') };
    const res = await fetch('/api/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    setLink(data.acceptUrl);
    toast.success('Invitation created');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLink(null); }}>
      <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" /> Invite member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
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
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required placeholder="staff@hotel.com" /></div>
            <div className="space-y-1.5"><Label htmlFor="role">Role</Label>
              <SelectHTML id="role" name="role" defaultValue="RECEPTIONIST">
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="HOUSEKEEPER">Housekeeper</option>
                <option value="ACCOUNTANT">Accountant</option>
              </SelectHTML>
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
