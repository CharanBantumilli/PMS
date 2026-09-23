'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeleteConfirmProps {
  entityName: string;
  deleteUrl: string;
  redirectUrl: string;
}

export function DeleteConfirm({ entityName, deleteUrl, redirectUrl }: DeleteConfirmProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${entityName}? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(`${entityName} deleted`);
      window.location.href = redirectUrl;
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
      setLoading(false);
    }
  };

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      {loading ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
