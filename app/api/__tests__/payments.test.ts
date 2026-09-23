import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as createPayment, GET as listPayments } from '@/app/api/payments/route';

function mockSession(role: string = 'ACCOUNTANT', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role,
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
      nights: 3, unitRate: '200', discount: '0', taxAmount: '0', status: 'CHECKED_IN',
    } as any);
    vi.mocked(prisma.payment.create).mockResolvedValueOnce({ id: 'p-1', amount: '5000' } as any);
    // Auto-invoice: check existing invoice → none found
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce(null);
    // Auto-invoice: get max invoice number → none found
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce(null);
    // Auto-invoice: create invoice
    vi.mocked(prisma.invoice.create).mockResolvedValueOnce({ id: 'inv-auto', invoiceNumber: 'INV-00001' } as any);
    // Link payment to invoice
    vi.mocked(prisma.payment.update).mockResolvedValueOnce({ id: 'p-1' } as any);
    // Invoice balance update: findUnique returns the auto-created invoice
    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
      id: 'inv-auto', total: '10000', paidAmount: '0', status: 'SENT', bookingId: 'b-1',
    } as any);
    vi.mocked(prisma.invoice.update).mockResolvedValueOnce({ id: 'inv-auto' } as any);
    // Booking balance update via invoice path
    vi.mocked(prisma.booking.update).mockResolvedValueOnce({
      id: 'b-1', totalAmount: '10000', paidAmount: '5000',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/payments', {
      method: 'POST',
      body: JSON.stringify(validPayment),
    });
    const res = await createPayment(req);
    expect(res.status).toBe(201);
    // Invoice should be auto-created
    expect(prisma.invoice.create).toHaveBeenCalled();
    // Invoice should be updated with payment amount
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv-auto' },
      data: expect.objectContaining({ paidAmount: { increment: 5000 } }),
    }));
    // Booking balance should be updated via the invoice path
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'b-1' },
      data: expect.objectContaining({ paidAmount: { increment: 5000 } }),
    }));
  });

  it('handles invoice-linked payments', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
      id: 'inv-1', total: '10000', paidAmount: '0', status: 'SENT',
    } as any);
    vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
      id: 'inv-1', total: '10000', paidAmount: '0', status: 'SENT', bookingId: null,
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
      data: expect.objectContaining({ paidAmount: { increment: 10000 } }),
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
    vi.mocked(prisma.payment.count).mockResolvedValueOnce(1);
    const req = new NextRequest('http://localhost:3000/api/payments');
    const res = await listPayments(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});
