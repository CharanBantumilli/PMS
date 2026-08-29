'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ExpenseDialog } from './expense-dialog';

type Expense = { id: string; category: string; description: string; amount: number; currency: string; vendor: string | null; expenseDate: string; notes: string | null; };

export function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Expense | null>(null);

  async function onDelete(e: Expense) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed'); return; }
    toast.success('Deleted');
    router.refresh();
  }

  return (
    <>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3">Vendor</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">{formatDate(e.expenseDate)}</td>
                <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{e.category.replace('_', ' ')}</span></td>
                <td className="px-3 py-2 text-slate-700">{e.description}</td>
                <td className="px-3 py-2 text-slate-500">{e.vendor || '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(e.amount, e.currency)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(e)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && <ExpenseDialog mode="edit" initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
