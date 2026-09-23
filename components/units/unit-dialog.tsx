'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SelectHTML } from '@/components/ui/select-native';
import { Loader2, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

type Unit = {
  id: string; number: string; name: string; status: string; floor?: string | null; notes?: string | null;
  propertyId: string; propertyName: string;
  unitType: { id: string; name: string } | null;
};

export function UnitDialog({
  mode, unit, properties, unitTypes, defaultPropertyId, onClose, onStatusChange,
}: {
  mode: 'create' | 'edit';
  unit?: Unit;
  properties: { id: string; name: string }[];
  unitTypes: { id: string; name: string }[];
  defaultPropertyId?: string;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [createdTypes, setCreatedTypes] = useState<{ id: string; name: string }[]>([]);

  const allTypes = [...unitTypes, ...createdTypes];

  async function createType(): Promise<string | null> {
    if (!newTypeName.trim()) return null;
    const res = await fetch('/api/unit-types', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newTypeName.trim() }),
    });
    if (!res.ok) { toast.error('Could not create unit type'); return null; }
    const data = await res.json();
    const newType = { id: data.id, name: data.name };
    setCreatedTypes((prev) => [...prev, newType]);
    setShowNewType(false);
    setNewTypeName('');
    toast.success('Unit type created');
    return newType.id;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    let unitTypeId = (e.currentTarget.querySelector('[name=unitTypeId]') as HTMLSelectElement)?.value || null;

    if (unitTypeId === '__new__') {
      const id = await createType();
      if (!id) { setLoading(false); return; }
      unitTypeId = id;
    }

    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: mode === 'edit' ? unit!.propertyId : form.get('propertyId'),
      unitTypeId: unitTypeId || null,
      name: form.get('name'),
      number: form.get('number'),
      floor: form.get('floor') || null,
      status: form.get('status') || 'VACANT_CLEAN',
      notes: form.get('notes') || null,
    };
    const url = mode === 'create' ? '/api/units' : `/api/units/${unit!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not save'); return; }
    toast.success(mode === 'create' ? 'Unit created' : 'Unit updated');
    onClose();
    router.refresh();
  }

  async function onDelete() {
    if (!unit) return;
    if (!confirm(`Delete unit #${unit.number}?`)) return;
    const res = await fetch(`/api/units/${unit.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not delete'); return; }
    toast.success('Unit deleted');
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New unit' : `Edit unit #${unit?.number}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="propertyId">Property</Label>
            <SelectHTML id="propertyId" name="propertyId" required defaultValue={unit?.propertyId || defaultPropertyId} disabled={mode === 'edit'}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectHTML>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="number">Unit #</Label>
            <Input id="number" name="number" required defaultValue={unit?.number} placeholder="101" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor">Floor</Label>
            <Input id="floor" name="floor" defaultValue={unit?.floor || ''} placeholder="1" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" required defaultValue={unit?.name} placeholder="Deluxe King with Sea View" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="unitTypeId">Unit type</Label>
            {showNewType ? (
              <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                <Input placeholder="Type name (e.g. Deluxe)" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={async () => {
                    const id = await createType();
                    if (id) {
                      const sel = document.getElementById('unitTypeId') as HTMLSelectElement;
                      if (sel) sel.value = id;
                    }
                  }} disabled={!newTypeName.trim()}>Save type</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewType(false); setNewTypeName(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <SelectHTML id="unitTypeId" name="unitTypeId" defaultValue={unit?.unitType?.id || ''} className="flex-1">
                  <option value="">— Unassigned —</option>
                  {allTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </SelectHTML>
                <Button type="button" size="icon" variant="outline" className="shrink-0 h-9 w-9" onClick={() => setShowNewType(true)} title="Create new type">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <SelectHTML id="status" name="status" defaultValue={unit?.status || 'VACANT_CLEAN'}>
              <option value="VACANT_CLEAN">Vacant clean</option>
              <option value="VACANT_DIRTY">Vacant dirty</option>
              <option value="OCCUPIED_CLEAN">Occupied clean</option>
              <option value="OCCUPIED_DIRTY">Occupied dirty</option>
              <option value="INSPECTION">Inspection</option>
              <option value="OUT_OF_ORDER">Out of order</option>
              <option value="OUT_OF_SERVICE">Out of service</option>
            </SelectHTML>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={unit?.notes || ''} />
          </div>
          <DialogFooter className="col-span-2 mt-2 flex w-full justify-between">
            <div>
              {mode === 'edit' && (
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
