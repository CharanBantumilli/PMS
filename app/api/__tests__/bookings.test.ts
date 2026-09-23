import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as createBooking, GET as listBookings } from '@/app/api/bookings/route';
import { POST as checkIn } from '@/app/api/bookings/[id]/check-in/route';
import { POST as checkOut } from '@/app/api/bookings/[id]/check-out/route';

function mockSession(role: string = 'OWNER', orgId: string = 'org-1') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id: 'user-1', email: 'test@test.com', organizationId: orgId, organizationSlug: 'test',
      role,
    },
    expires: '2099-01-01',
  } as any);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: orgId, currency: 'INR' } as any);
}

const validBooking = {
  propertyId: 'prop-1',
  guestId: 'guest-1',
  unitId: 'unit-1',
  arrivalDate: '2026-12-01',
  departureDate: '2026-12-03',
  adults: 2,
  children: 0,
  unitRate: 5000,
  discount: 0,
  taxAmount: 0,
};

describe('POST /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('rejects unauthorized requests', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBooking),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid input (missing required fields)', async () => {
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ propertyId: 'p1' }),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(400);
  });

  it('rejects when property does not belong to org', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce({ id: 'guest-1' } as any);
    vi.mocked(prisma.property.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBooking),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/property/i);
  });

  it('rejects when guest does not belong to org', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBooking),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/guest/i);
  });

  it('rejects when departure is before arrival', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce({ id: 'guest-1' } as any);
    vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any);
    vi.mocked(prisma.unit.findFirst).mockResolvedValueOnce({ id: 'unit-1' } as any);
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ ...validBooking, arrivalDate: '2026-12-05', departureDate: '2026-12-01' }),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/departure/i);
  });

  it('rejects conflicting bookings on the same unit', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce({ id: 'guest-1' } as any);
    vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any);
    vi.mocked(prisma.unit.findFirst).mockResolvedValueOnce({ id: 'unit-1' } as any);
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({ id: 'existing' } as any);
    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBooking),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/available/i);
  });

  it('creates a booking successfully', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce({ id: 'guest-1' } as any);
    vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any);
    vi.mocked(prisma.unit.findFirst).mockResolvedValueOnce({ id: 'unit-1' } as any);
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce(null); // no conflict
    vi.mocked(prisma.booking.create).mockResolvedValueOnce({
      id: 'new-booking',
      confirmationCode: 'B-TEST1234',
      nights: 2,
      totalAmount: '10000',
      currency: 'INR',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(validBooking),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.confirmationCode).toMatch(/^B-/);
    expect(body.nights).toBe(2);
  });

  it('calculates total correctly (nights × rate - discount + tax)', async () => {
    vi.mocked(prisma.guest.findFirst).mockResolvedValueOnce({ id: 'guest-1' } as any);
    vi.mocked(prisma.property.findFirst).mockResolvedValueOnce({ id: 'prop-1' } as any);
    vi.mocked(prisma.unit.findFirst).mockResolvedValueOnce({ id: 'unit-1' } as any);
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce(null);
    let capturedData: any;
    vi.mocked(prisma.booking.create).mockImplementationOnce(((args: any) => {
      capturedData = args.data;
      return Promise.resolve({ id: 'b', ...args.data, confirmationCode: 'B-TEST' } as any);
    }) as any);

    const req = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ ...validBooking, discount: 10, taxAmount: 18 }), // 10% discount, 18% tax
    });
    await createBooking(req);
    // 2 nights × 5000 = 10000 subtotal
    // 10% discount = 1000
    // 18% tax on (10000-1000) = 1620
    // total = 10000 - 1000 + 1620 = 10620
    expect(Number(capturedData.totalAmount)).toBe(10620);
  });
});

describe('POST /api/bookings/[id]/check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('checks in a confirmed booking', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'CONFIRMED', unitId: 'u-1', balance: '0', currency: 'INR',
      guest: { firstName: 'John', lastName: 'Doe' }, property: { name: 'Test' }, unit: { number: '101' },
    } as any);
    vi.mocked(prisma.booking.update).mockResolvedValueOnce({ id: 'b-1', status: 'CHECKED_IN' } as any);
    vi.mocked(prisma.unit.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.housekeepingTask.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.housekeepingTask.create).mockResolvedValueOnce({} as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-in', { method: 'POST' });
    const res = await checkIn(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('CHECKED_IN');
  });

  it('rejects check-in from CANCELED status', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'CANCELED', balance: '0', currency: 'INR',
      guest: { firstName: 'John', lastName: 'Doe' }, property: { name: 'Test' }, unit: { number: '101' },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-in', { method: 'POST' });
    const res = await checkIn(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(400);
  });

  it('returns 200 (idempotent) for already CHECKED_IN booking', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'CHECKED_IN', balance: '0', currency: 'INR',
      guest: { firstName: 'John', lastName: 'Doe' }, property: { name: 'Test' }, unit: { number: '101' },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-in', { method: 'POST' });
    const res = await checkIn(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent booking', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/bookings/nope/check-in', { method: 'POST' });
    const res = await checkIn(req, { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/bookings/[id]/check-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('checks out a CHECKED_IN booking with zero balance', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'CHECKED_IN', balance: '0', totalAmount: '5000', unitId: 'u-1', guestId: 'g-1', propertyId: 'p-1',
      guest: { firstName: 'John', lastName: 'Doe' }, property: { name: 'Test' }, unit: { number: '101' },
    } as any);
    vi.mocked(prisma.booking.update).mockResolvedValueOnce({ id: 'b-1', status: 'CHECKED_OUT' } as any);
    vi.mocked(prisma.unit.findUnique).mockResolvedValueOnce({ status: 'OCCUPIED_CLEAN' } as any);
    vi.mocked(prisma.unit.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.guest.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.housekeepingTask.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.housekeepingTask.create).mockResolvedValueOnce({} as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-out', { method: 'POST' });
    const res = await checkOut(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(200);
  });

  it('rejects check-out with outstanding balance', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'CHECKED_IN', balance: '1000', totalAmount: '5000', unitId: 'u-1', guestId: 'g-1', propertyId: 'p-1',
      guest: { firstName: 'John', lastName: 'Doe' }, property: { name: 'Test' }, unit: { number: '101' },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-out', { method: 'POST' });
    const res = await checkOut(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/balance/i);
  });

  it('rejects check-out from PENDING status', async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValueOnce({
      id: 'b-1', status: 'PENDING', balance: '0',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/bookings/b-1/check-out', { method: 'POST' });
    const res = await checkOut(req, { params: { id: 'b-1' } });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it('lists bookings for the organization', async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValueOnce([
      { id: 'b-1' }, { id: 'b-2' },
    ] as any);
    vi.mocked(prisma.booking.count).mockResolvedValueOnce(2);
    const req = new NextRequest('http://localhost:3000/api/bookings');
    const res = await listBookings(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it('rejects unauthorized', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/bookings');
    const res = await listBookings(req);
    expect(res.status).toBe(401);
  });
});
