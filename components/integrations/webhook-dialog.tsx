'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const WEBHOOK_EVENTS = [
  'booking.created', 'booking.updated', 'booking.confirmed', 'booking.checked_in',
  'booking.checked_out', 'booking.canceled', 'payment.received', 'invoice.created', 'guest.created',
];

export function WebhookDialog({ mode }: { mode: 'create' | 'edit' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const events = WEBHOOK_EVENTS.filter((ev) => form.get(ev));
    const body = { name: form.get('name'), url: form.get('url'), events };
    const res = await fetch('/api/webhooks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success('Webhook created');
    setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New webhook</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="My booking webhook" /></div>
          <div className="space-y-1.5"><Label htmlFor="url">URL</Label><Input id="url" name="url" type="url" required placeholder="https://example.com/webhook" /></div>
          <div className="space-y-1.5">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-1 rounded-md border p-2 max-h-48 overflow-y-auto">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-xs"><input type="checkbox" name={ev} defaultChecked /> {ev}</label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
