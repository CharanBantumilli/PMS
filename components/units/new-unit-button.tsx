'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { UnitDialog } from './unit-dialog';

type Property = { id: string; name: string };
type UnitType = { id: string; name: string; basePrice: number };

export function NewUnitButton({ properties, unitTypes, defaultPropertyId }: { properties: Property[]; unitTypes: UnitType[]; defaultPropertyId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create new unit</Button>
      {open && (
        <UnitDialog
          mode="create"
          properties={properties}
          unitTypes={unitTypes}
          defaultPropertyId={defaultPropertyId}
          onClose={() => { setOpen(false); router.push('/dashboard/units'); }}
        />
      )}
    </>
  );
}
