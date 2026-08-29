import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as createPayment, GET as listPayments } from '@/app/api/payments/route';

function mockSession(role: string = 'ACCOUNTANT', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role, isSuperAdmin: false,
    },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId } as any);
}


const validPayment = {
  bookingId: 'b-1',
  amount: 5000,
  method: 'CARD',
  status: 'PAID',
};

describe('POST /api/payments', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('rejects unauthorized', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify(validPayment),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(401);
  });

  it('rejects HOUSEKEEPER (insufficient role)', async () => {
    // prisma mocks reset individually below
    mockSession();
    mockSession('HOUSEKEEPER');
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify(validPayment),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(403);
  });

  it('rejects negative amount', async () => {
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify({ ...validPayment, amount: -10 }),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(400);
  });

  it('rejects when booking does not exist', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify(validPayment),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(400);
  });

  it('creates a payment and updates booking balance', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', organizationId: 'org-1', totalAmount: '10000', paidAmount: '0',
    } as any);
    vi.mocked(prisma.payment.create).mockResolvedValueOnce({ id: 'p-1', amount: '5000' } as any);

    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify(validPayment),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(201);
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'b-1' },
      data: expect.objectContaining({ paidAmount: 5000, balance: 5000 }),
    }));
  });

  it('handles invoice-linked payments', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
      id: 'inv-1', total: '10000', paidAmount: '0', status: 'SENT',
    } as any);
    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
      id: 'inv-1', total: '10000', paidAmount: '0', status: 'SENT',
    } as any);
    vi.mocked(prisma.payment.create).mockResolvedValueOnce({ id: 'p-1', amount: '10000' } as any);

    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-1', amount: 10000, method: 'CASH', status: 'PAID' }),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(201);
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv-1' },
      data: expect.objectContaining({ status: 'PAID', balance: 0 }),
    }));
  });
});

describe('GET /api/payments', () => {
  beforeEach(() => {
    // prisma mocks reset individually below
    mockSession();
  });

  it('lists payments for the organization', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValueOnce([{ id: 'p-1' }] as any);
    const res = await listPayments();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});
