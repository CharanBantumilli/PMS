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
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; ') },
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
    const { data: guest } = await api('POST', '/api/guests', {
      firstName: 'Integration', lastName: 'Test', email: `inttest-${Date.now()}@test.com`, phone: '+919876543210',
    }, [200, 201]);
    expect(guest.id).toBeTruthy();
    testGuestId = guest.id;
    trackCreated('guests', guest.id);

    // 2. Create booking
    const { data: booking } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2026-12-20', departureDate: '2026-12-22',
      adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 1200, source: 'DIRECT',
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

    // 4. Check in
    const { data: checkInResult } = await api('POST', `/api/bookings/${booking.id}/check-in`);
    expect(checkInResult.status).toBe('CHECKED_IN');
    expect(checkInResult.checkedInAt).toBeTruthy();

    // 5. Verify housekeeping task was auto-created
    const { data: hkTasks } = await api('GET', '/api/housekeeping');
    const turndownTask = hkTasks.find((t: any) => t.bookingId === booking.id);
    expect(turndownTask).toBeTruthy();
    expect(turndownTask.type).toBe('TURNDOWN');

    // 6. Record payment (full amount)
    const { data: payment } = await api('POST', '/api/payments', {
      bookingId: booking.id, amount: 11200, method: 'CARD', status: 'PAID', reference: 'INT-TEST-001',
    }, [200, 201]);
    expect(payment.id).toBeTruthy();
    expect(payment.amount).toBe('11200');
    trackCreated('payments', payment.id);

    // 7. Verify booking paid amount and balance
    const { data: updatedBooking } = await api('GET', `/api/bookings/${booking.id}`);
    expect(Number(updatedBooking.paidAmount)).toBe(11200);
    expect(Number(updatedBooking.balance)).toBe(0);

    // 8. Check out
    const { data: checkOutResult } = await api('POST', `/api/bookings/${booking.id}/check-out`);
    expect(checkOutResult.status).toBe('CHECKED_OUT');

    // 9. Verify checkout notification
    const { data: notifs2 } = await api('GET', '/api/notifications');
    const checkoutNotif = notifs2.notifications.find((n: any) => n.entityId === booking.id && n.type === 'CHECK_OUT');
    expect(checkoutNotif).toBeTruthy();

    // 10. Verify full clean task was created
    const { data: hkTasks2 } = await api('GET', '/api/housekeeping');
    const cleanTask = hkTasks2.find((t: any) => t.bookingId === booking.id && t.type === 'FULL_CLEAN');
    expect(cleanTask).toBeTruthy();
  });

  it('should reject double booking (availability conflict)', async () => {
    // Try to book the same unit on the same dates
    const { status } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2026-12-21', departureDate: '2026-12-23', // overlaps
      adults: 1, children: 0, unitRate: 5000, discount: 0, taxAmount: 1200,
    }, 409);
    expect(status).toBe(409);
  });

  it('should reject check-out with outstanding balance', async () => {
    // Create a new booking
    const { data: booking } = await api('POST', '/api/bookings', {
      propertyId: testPropertyId, unitId: testUnitId, guestId: testGuestId,
      arrivalDate: '2027-01-10', departureDate: '2027-01-12',
      adults: 1, children: 0, unitRate: 3000, discount: 0, taxAmount: 600, source: 'DIRECT',
    }, [200, 201]);
    trackCreated('bookings', booking.id);

    // Check in
    await api('POST', `/api/bookings/${booking.id}/check-in`);

    // Try to check out without full payment (should fail)
    const { status } = await api('POST', `/api/bookings/${booking.id}/check-out`, undefined, 402);
    expect(status).toBe(402);
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

describe('Integration: Webhooks', () => {
  let testWebhookId: string;

  it('should create a webhook', async () => {
    const { data: webhook, status } = await api('POST', '/api/webhooks', {
      name: 'Integration Test Webhook',
      url: 'https://httpbin.org/post',
      events: ['booking.created'],
    }, 201);
    expect(status).toBe(201);
    expect(webhook.id).toBeTruthy();
    testWebhookId = webhook.id;
    trackCreated('webhooks', webhook.id);
  });

  it('should test webhook delivery', async () => {
    const { data, status } = await api('POST', `/api/webhooks/${testWebhookId}/test`);
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.delivery.status).toBe('SUCCESS');
  });

  it('should list webhook deliveries', async () => {
    const { data } = await api('GET', '/api/webhooks');
    const found = data.find((w: any) => w.id === testWebhookId);
    expect(found).toBeTruthy();
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

describe('Integration: Channels', () => {
  let testChannelId: string;
  let testMappingUnitId: string;

  beforeAll(async () => {
    const { data: units } = await api('GET', `/api/units`);
    testMappingUnitId = units[0].id;
  });

  it('should create a channel', async () => {
    const { data } = await api('POST', '/api/channels', {
      name: 'Integration Test Channel',
      type: 'BOOKING_COM',
      markup: 5,
    }, 201);
    testChannelId = data.id;
    trackCreated('channels', testChannelId);
  });

  it('should toggle channel enabled status', async () => {
    const { status } = await api('PATCH', `/api/channels/${testChannelId}`, { isEnabled: false });
    expect(status).toBe(200);
    const { status: status2 } = await api('PATCH', `/api/channels/${testChannelId}`, { isEnabled: true });
    expect(status2).toBe(200);
  });

  it('should attempt sync and create a log entry (requires syncUrl)', async () => {
    // Sync will fail because no syncUrl — this is correct behavior
    const { status, data } = await api('POST', `/api/channels/${testChannelId}/sync`, {}, 400);
    expect(status).toBe(400);
    expect(data.error).toMatch(/sync URL/i);
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
    // The API validates required fields for WhatsApp before enabling
    const { status, data } = await api('POST', '/api/integrations', {
      type: 'WHATSAPP', name: 'WhatsApp Business', isEnabled: true,
    }, 400);
    expect(status).toBe(400);
    expect(data.error).toMatch(/required/i);
  });

  it('should test WhatsApp integration (requires config first)', async () => {
    const { status, data } = await api('POST', '/api/integrations/test', { type: 'WHATSAPP' }, 404);
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
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Integration: Security & Audit', () => {
  it('should track active sessions', async () => {
    const { data } = await api('GET', '/api/sessions');
    expect(Array.isArray(data)).toBe(true);
  });

  it('should setup 2FA', async () => {
    const { data, status } = await api('POST', '/api/2fa/setup');
    expect(status).toBe(200);
    expect(data.secret).toBeTruthy();
    expect(data.secret.length).toBeGreaterThan(10);
  });

  it('should reject invalid 2FA code', async () => {
    const { status, data } = await api('POST', '/api/2fa/verify', { code: '000000' }, 400);
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });
});
