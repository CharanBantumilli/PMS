import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as createExpense, GET as listExpenses } from '@/app/api/expenses/route';
import { PATCH as patchExpense, DELETE as deleteExpense } from '@/app/api/expenses/[id]/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1', userId: string = 'user-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, email: 't@t.com', organizationId: orgId, organizationSlug: 'test', role, isSuperAdmin: false },
    expires: '2099-01-01',
  } as any);
  // apiContext org lookup — currency included since expenses inherit it
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId, currency: 'INR' } as any);
}

const post = (body: any) => new NextRequest('http://localhost:3000/api/expenses', { method: 'POST', body: JSON.stringify(body) });
const patch = (id: string, body: any) => new NextRequest(`http://localhost:3000/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
const del = (id: string) => new NextRequest(`http://localhost:3000/api/expenses/${id}`, { method: 'DELETE' });

describe('POST /api/expenses', () => {
  beforeEach(() => mockSession());

  const valid = { category: 'UTILITIES', description: 'August power bill', amount: 4200.5, expenseDate: '2026-08-26', vendor: 'MSEB' };

  it('creates an expense with a plain YYYY-MM-DD date string (regression: Prisma @db.Date crash)', async () => {
    vi.mocked(prisma.expense.create).mockResolvedValueOnce({ id: 'e1', ...valid } as any);
    const res = await createExpense(post(valid));
    expect(res.status).toBe(201);
    const args = vi.mocked(prisma.expense.create).mock.calls[0][0] as any;
    expect(args.data.expenseDate).toBeInstanceOf(Date);          // coerced, not a raw string
    expect((args.data.expenseDate as Date).getUTCDate()).toBe(26);
    expect(args.data.currency).toBe('INR');                       // inherited from workspace
  });

  it('rejects impossible dates cleanly (400, not 500)', async () => {
    const res = await createExpense(post({ ...valid, expenseDate: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('rejects negative amounts', async () => {
    const res = await createExpense(post({ ...valid, amount: -5 }));
    expect(res.status).toBe(400);
  });

  it('rejects categories outside the enum', async () => {
    const res = await createExpense(post({ ...valid, category: 'BRIBES' }));
    expect(res.status).toBe(400);
  });

  it('accountant can record expenses', async () => {
    mockSession('ACCOUNTANT');
    vi.mocked(prisma.expense.create).mockResolvedValueOnce({ id: 'e2' } as any);
    const res = await createExpense(post(valid));
    expect(res.status).toBe(201);
  });

  it('housekeeper cannot record expenses', async () => {
    mockSession('HOUSEKEEPER');
    const res = await createExpense(post(valid));
    expect(res.status).toBe(403);
  });

  it('receptionist cannot record expenses', async () => {
    mockSession('RECEPTIONIST');
    const res = await createExpense(post(valid));
    expect(res.status).toBe(403);
  });
});

describe('PATCH & DELETE /api/expenses/[id]', () => {
  beforeEach(() => mockSession());

  it('edit coerces replacement dates too', async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1', organizationId: 'org-1', description: 'Old' } as any);
    vi.mocked(prisma.expense.update).mockResolvedValueOnce({ id: 'e1' } as any);
    const res = await patchExpense(patch('e1', { expenseDate: '2026-09-01' }), { params: { id: 'e1' } });
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.expense.update).mock.calls.at(-1)![0] as any;
    expect(args.data.expenseDate).toBeInstanceOf(Date);
  });

  it('manager can edit but only owner/admin/accountant can delete', async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1', organizationId: 'org-1' } as any);

    mockSession('MANAGER');
    const delAsManager = await deleteExpense(del('e1'), { params: { id: 'e1' } });
    expect(delAsManager.status).toBe(403);

    mockSession('ACCOUNTANT');
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1', organizationId: 'org-1' } as any);
    vi.mocked(prisma.expense.delete).mockResolvedValueOnce({ id: 'e1' } as any);
    const delAsAccountant = await deleteExpense(del('e1'), { params: { id: 'e1' } });
    expect(delAsAccountant.status).toBe(200);
  });

  it('expense from another org is 404, not leaked', async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);
    const res = await deleteExpense(del('foreign-id'), { params: { id: 'foreign-id' } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/expenses', () => {
  it('lists are readable by money roles and housekeeping alike (shared dashboard)', async () => {
    for (const role of ['OWNER', 'ACCOUNTANT', 'HOUSEKEEPER']) {
      mockSession(role);
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([{ id: 'e1', currency: 'INR' }] as any);
      const res = await listExpenses();
      expect(res.status).toBe(200);
      expect((await res.json())[0].currency).toBe('INR');
    }
  });
});
