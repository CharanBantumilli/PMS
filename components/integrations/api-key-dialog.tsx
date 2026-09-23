'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export function ApiKeyDialog({ mode }: { mode: 'create' | 'edit' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = { name: form.get('name') };
    const res = await fetch('/api/api-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    setNewKey(data.key);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewKey(null); }}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New API key</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{newKey ? 'Save your API key' : 'New API key'}</DialogTitle></DialogHeader>
        {newKey ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">This is the only time you'll see this key. Copy it now.</p>
            <div className="flex items-center gap-2 rounded-md border bg-slate-50 p-3">
              <code className="flex-1 text-xs font-mono break-all">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(newKey)}><Copy className="h-3 w-3" /></Button>
            </div>
            <DialogFooter><Button onClick={() => { setOpen(false); setNewKey(null); }}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Production server" /></div>
            <p className="text-xs text-slate-500">The key will have full access to your organization. Store it securely.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create key</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
