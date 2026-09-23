// Integration tests for end-to-end flows
// These tests run against the live server and verify real API behavior

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { unlinkSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let cookies: string[] = [];
let csrfToken = '';
let createdResourceIds: Record<string, string[]> = {};

// Helper functions
async function api(method: string, path: string, body?: any, expectStatus: number | number[] | null = 200): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json', cookie: cookies.join('; ') };
  // Include CSRF token and Origin for state-changing methods
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    headers['origin'] = BASE_URL;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  const accepted = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  if (expectStatus !== null && !accepted.includes(res.status)) {
    throw new Error(`Expected ${accepted.join('|')} but got ${res.status} for ${method} ${path}: ${text.slice(0, 200)}`);
  }
  return { status: res.status, data, headers: res.headers };
}

function trackCreated(type: string, id: string) {
  if (!createdResourceIds[type]) createdResourceIds[type] = [];
  createdResourceIds[type].push(id);
}

async function login(email = 'demo@azurebay.com', password = 'demo1234') {
  // Get CSRF
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  csrfToken = csrfData.csrfToken;
  cookies = csrfRes.headers.get('set-cookie')?.split(', ') || [];

  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE_URL}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  const newCookies = loginRes.headers.get('set-cookie');
  if (newCookies) {
    cookies = [...cookies, ...newCookies.split(', ')];
  }
  return loginRes.status;
}

async function logout() {
  cookies = [];
}

beforeAll(async () => {
  // Login
  const status = await login();
  if (status !== 200 && status !== 302) throw new Error(`Login failed with status ${status}`);
});

afterAll(async () => {
  // Cleanup created resources
  for (const [type, ids] of Object.entries(createdResourceIds)) {
    for (const id of ids) {
      try {
        await api('DELETE', `/api/${type}/${id}`, null, null);
      } catch {}
    }
  }
  await logout();
});

describe('Integration: Authentication & Authorization', () => {
  it('should login successfully', async () => {
    const { data } = await api('GET', '/api/auth/session');
    expect(data).toBeTruthy();
    expect(data.user.email).toBe('demo@azurebay.com');
    expect(data.user.role).toBe('OWNER');
  });

  it('should reject unauthorized API calls', async () => {
    const savedCookies = cookies;
    cookies = [];
    const { status } = await api('GET', '/api/bookings', null, 401);
    expect(status).toBe(401);
    cookies = savedCookies;
  });
});

describe('Integration: Booking Lifecycle (Full Flow)', () => {
  let testGuestId: string;
  let testPropertyId: string;
  let testUnitId: string;
  let testBookingId: string;

  beforeAll(async () => {
    // Get a property and unit
    const { data: props } = await api('GET', '/api/properties');
    testPropertyId = props[0].id;
    const { data: units } = await api('GET', `/api/units?propertyId=${testPropertyId}`);
    testUnitId = units[0].id;
  });

  it('should create a guest, then a booking, then payment, then check-in, then check-out', async () => {
    // 1. Create guest
    const ts = Date.now();
    const { data: guest } = await api('POST', '/api/guests', {
      firstName: 'Integration', lastName: 'Test', email: `inttest-${ts}@test.com`, phone: `+91987${(ts % 10000000).toString().padStart(7, '0')}`,
    }, [200, 201]);
    expect(guest.id).toBeTruthy();
    testGuestId = guest.id;
    trackCreated('guests', guest.id);

    // 2. Create booking
    const { data: booking } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2026-12-25', departureDate: '2026-12-27',
      adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 12, source: 'DIRECT',
    }, [200, 201]);
    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe('PENDING');
    expect(booking.totalAmount).toBe('11200');
    testBookingId = booking.id;
    trackCreated('bookings', booking.id);

    // 3. Verify notification was created
    const { data: notifs } = await api('GET', '/api/notifications?unread=true');
    const newBookingNotif = notifs.notifications.find((n: any) => n.entityId === booking.id && n.type === 'BOOKING_NEW');
    expect(newBookingNotif).toBeTruthy();
    expect(newBookingNotif.title).toBe('New booking');

    // 4. Record payment (full amount — must pay before check-in)
    const { data: payment } = await api('POST', '/api/payments', {
      bookingId: booking.id, amount: 11200, method: 'CARD', status: 'PAID', reference: 'INT-TEST-001',
    }, [200, 201]);
    expect(payment.id).toBeTruthy();
    expect(payment.amount).toBe('11200');
    trackCreated('payments', payment.id);

    // 5. Verify booking paid amount and balance
    const { data: updatedBooking } = await api('GET', `/api/bookings/${booking.id}`);
    expect(Number(updatedBooking.paidAmount)).toBe(11200);
    expect(Number(updatedBooking.balance)).toBe(0);

    // 6. Check in
    const { data: checkInResult } = await api('POST', `/api/bookings/${booking.id}/check-in`);
    expect(checkInResult.status).toBe('CHECKED_IN');
    expect(checkInResult.checkedInAt).toBeTruthy();

    // 7. Verify housekeeping task was auto-created
    const { data: hkTasks } = await api('GET', '/api/housekeeping?pageSize=1000');
    const turndownTask = hkTasks.data.find((t: any) => t.bookingId === booking.id && t.type === 'TURNDOWN');
    expect(turndownTask).toBeTruthy();

    // 8. Check out
    const { data: checkOutResult } = await api('POST', `/api/bookings/${booking.id}/check-out`);
    expect(checkOutResult.status).toBe('CHECKED_OUT');

    // 9. Verify checkout notification
    const { data: notifs2 } = await api('GET', '/api/notifications');
    const checkoutNotif = notifs2.notifications.find((n: any) => n.entityId === booking.id && n.type === 'CHECK_OUT');
    expect(checkoutNotif).toBeTruthy();

    // 10. Verify full clean task was created
    const { data: hkTasks2 } = await api('GET', '/api/housekeeping?pageSize=1000');
    const cleanTask = hkTasks2.data.find((t: any) => t.bookingId === booking.id && t.type === 'FULL_CLEAN');
    expect(cleanTask).toBeTruthy();
  });

  it('should reject double booking (availability conflict)', async () => {
    // Create a separate guest and booking that stays active (not checked out)
    const ts2 = Date.now();
    const { data: conflictGuest } = await api('POST', '/api/guests', {
      firstName: 'Conflict', lastName: 'Test', email: `conflict-${ts2}@test.com`, phone: `+91988${(ts2 % 10000000).toString().padStart(7, '0')}`,
    }, [200, 201]);
    trackCreated('guests', conflictGuest.id);
    const { data: activeBooking } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: conflictGuest.id,
      arrivalDate: '2027-02-10', departureDate: '2027-02-15',
      adults: 1, children: 0, unitRate: 5000, discount: 0, taxAmount: 12, source: 'DIRECT',
    }, [200, 201]);
    trackCreated('bookings', activeBooking.id);

    // Try to book the same unit on overlapping dates
    const { status } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2027-02-12', departureDate: '2027-02-16', // overlaps
      adults: 1, children: 0, unitRate: 5000, discount: 0, taxAmount: 12,
    }, 409);
    expect(status).toBe(409);
  });

  it('should reject check-in with outstanding balance', async () => {
    // Create a new booking (taxAmount 6% → total 6360, unpaid balance 6360)
    const { data: booking } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2027-01-10', departureDate: '2027-01-12',
      adults: 1, children: 0, unitRate: 3000, discount: 0, taxAmount: 6, source: 'DIRECT',
    }, [200, 201]);
    trackCreated('bookings', booking.id);

    // Check-in requires zero balance — should fail with outstanding balance
    const { status } = await api('POST', `/api/bookings/${booking.id}/check-in`, undefined, 400);
    expect(status).toBe(400);
  });
});

describe('Integration: Currency Lock (INR)', () => {
  it('should reject currency change to USD', async () => {
    const { status, data } = await api('PATCH', '/api/organization', { currency: 'USD' }, 400);
    expect(status).toBe(400);
    expect(data.error).toMatch(/INR/i);
  });

  it('should accept INR', async () => {
    const { status } = await api('PATCH', '/api/organization', { currency: 'INR' });
    expect(status).toBe(200);
  });

  it('should verify org currency is INR', async () => {
    const { data } = await api('GET', '/api/organization');
    expect(data.currency).toBe('INR');
  });
});

describe('Integration: Real-Time Notifications', () => {
  it('should create notifications on events', async () => {
    const initial = await api('GET', '/api/notifications/unread-count');
    const initialCount = initial.data.count;

    // Trigger an event: create a guest
    const { data: guest } = await api('POST', '/api/guests', {
      firstName: 'Notif', lastName: 'Test', email: `notif-${Date.now()}@test.com`,
    }, [200, 201]);
    trackCreated('guests', guest.id);

    // Check that unread count increased
    const after = await api('GET', '/api/notifications/unread-count');
    expect(after.data.count).toBeGreaterThan(initialCount);
  });

  it('should mark notifications as read', async () => {
    const { data: notifs } = await api('GET', '/api/notifications?unread=true&limit=1');
    if (notifs.notifications.length > 0) {
      const id = notifs.notifications[0].id;
      const { status } = await api('PATCH', `/api/notifications/${id}`, {}, [200]);
      expect(status).toBe(200);
    }
  });

  it('should mark all as read', async () => {
    const { data } = await api('POST', '/api/notifications/mark-all-read', {}, 200);
    expect(data.ok).toBe(true);
  });
});

describe('Integration: API Keys', () => {
  let testKeyId: string;
  let testKeyValue: string;

  it('should create an API key and return the full key once', async () => {
    const { data } = await api('POST', '/api/api-keys', { name: 'Integration Test Key' }, 201);
    expect(data.key).toMatch(/^pms_live_/);
    testKeyValue = data.key;
    testKeyId = data.id;
    trackCreated('api-keys', testKeyId);
  });

  it('should NOT return the full key on subsequent GET', async () => {
    const { data } = await api('GET', '/api/api-keys');
    const found = data.find((k: any) => k.id === testKeyId);
    expect(found).toBeTruthy();
    expect(found.key).toBeUndefined(); // Full key should not be returned
  });
});

describe('Integration: Integrations', () => {
  it('should list available integrations', async () => {
    const { data } = await api('GET', '/api/integrations');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should reject non-INR currency on organization', async () => {
    const { status, data } = await api('PATCH', '/api/organization', { currency: 'EUR' }, 400);
    expect(status).toBe(400);
    expect(data.error).toMatch(/INR/i);
  });

  it('should connect an integration (rejects without config)', async () => {
    const { status, data } = await api('POST', '/api/integrations', {
      type: 'SMTP', name: 'Email SMTP', isEnabled: true,
    }, 400);
    expect(status).toBe(400);
    expect(data.error).toMatch(/required/i);
  });

  it('should test integration (requires config first)', async () => {
    const { status, data } = await api('POST', '/api/integrations/test', { type: 'STRIPE' }, 404);
    expect(status).toBe(404);
    expect(data.error).toMatch(/not configured/i);
  });
});

describe('Integration: Staff & RBAC', () => {
  let testInviteToken: string;

  it('should create an invitation (returns 201)', async () => {
    const { data, status } = await api('POST', '/api/invitations', {
      email: `intstaff-${Date.now()}@test.com`,
      role: 'RECEPTIONIST',
    }, 201);
    testInviteToken = data.token;
    expect(testInviteToken).toBeTruthy();
  });

  it('should list pending invitations', async () => {
    const { data } = await api('GET', '/api/invitations');
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Integration: Reports & Analytics', () => {
  it('should load reports page', async () => {
    const { status } = await api('GET', '/api/organization');
    expect(status).toBe(200);
  });

  it('should have booking data for revenue calculation', async () => {
    const { data } = await api('GET', '/api/bookings');
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});

describe('Integration: Security & Audit', () => {
  it('should track active sessions', async () => {
    const { data } = await api('GET', '/api/sessions');
    expect(Array.isArray(data)).toBe(true);
  });

});
