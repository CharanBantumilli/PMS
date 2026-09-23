import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet } from 'lucide-react';
import { ExpensesTable } from '@/components/expenses/expenses-table';
import { ExpenseDialog } from '@/components/expenses/expense-dialog';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

export default async function ExpensesPage() {
  const session = await auth();
  const orgId = session!.user.organizationId!;
  const [expenses, monthAgg, lastMonthAgg, byCategory, org] = await Promise.all([
    prisma.expense.findMany({ where: { organizationId: orgId }, orderBy: { expenseDate: 'desc' }, take: 200 }),
    prisma.expense.aggregate({ where: { organizationId: orgId, expenseDate: { gte: startOfMonth(new Date()), lte: endOfMonth(new Date()) } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { organizationId: orgId, expenseDate: { gte: startOfMonth(subMonths(new Date(), 1)), lte: endOfMonth(subMonths(new Date(), 1)) } }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ['category'], where: { organizationId: orgId }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ]);
  const currency = org?.currency || 'INR';
  const monthTotal = Number(monthAgg._sum.amount || 0);
  const lastTotal = Number(lastMonthAgg._sum.amount || 0);
  const change = lastTotal > 0 ? ((monthTotal - lastTotal) / lastTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-600">Track operational costs and outgoings by category.</p>
        </div>
        <ExpenseDialog mode="create" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">This month</div><div className="mt-1 text-2xl font-bold">{formatCurrency(monthTotal, currency)}</div><div className={change > 0 ? 'text-xs text-red-600' : 'text-xs text-emerald-600'}>{change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs last month</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Last month</div><div className="mt-1 text-2xl font-bold">{formatCurrency(lastTotal, currency)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Records</div><div className="mt-1 text-2xl font-bold">{expenses.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Top category</div><div className="mt-1 text-lg font-bold">{byCategory[0]?.category?.replace('_', ' ') || '—'}</div><div className="text-xs text-slate-500">{formatCurrency(Number(byCategory[0]?._sum.amount || 0), currency)}</div></CardContent></Card>
      </div>
      {expenses.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Wallet className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No expenses recorded</h2>
        </CardContent></Card>
      ) : (
        <ExpensesTable expenses={expenses.map((e) => ({
          id: e.id, category: e.category, description: e.description,
          amount: Number(e.amount), currency: e.currency, vendor: e.vendor,
          expenseDate: e.expenseDate.toISOString(), notes: e.notes,
        }))} />
      )}
    </div>
  );
}
