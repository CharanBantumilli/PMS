// Comprehensive functional test — runs against live dev server
// Tests every feature end-to-end via API + page rendering

const BASE = 'http://localhost:3000';
let cookies = [];
let csrfToken = '';

// ── Helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body, expectStatus = 200) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; '), origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
  if (!ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status} (expected ${expectStatus})`);
    console.error(`    ${text.slice(0, 200)}`);
  }
  return { status: res.status, data, ok };
}

async function page(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookies.join('; '), origin: BASE }, redirect: 'manual' });
  const text = await res.text();
  const ok = res.status === 200 && text.includes('__next');
  if (!ok) console.error(`  ✗ GET ${path} → ${res.status} (size=${text.length})`);
  return { status: res.status, ok, html: text };
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  csrfToken = csrfData.csrfToken;
  cookies = (csrfRes.headers.getSetCookie?.() || csrfRes.headers.get('set-cookie')?.split(', ') || []).map(c => c.split(';')[0]);

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken, email: 'demo@azurebay.com', password: 'demo1234', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  const rawNC = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(', ') || [];
  const newCookies = rawNC.map((c: string) => c.split(';')[0]);
  cookies = [...cookies, ...newCookies];
  return loginRes.status;
}

let passed = 0, failed = 0;
function test(name, ok) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

// ── Run ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n═══ 1. AUTHENTICATION ═══');
  const loginStatus = await login();
  test('Login with demo@azurebay.com', loginStatus === 200 || loginStatus === 302);
  const session = await api('GET', '/api/auth/session');
  test('Session is valid', session.ok && session.data?.user?.email === 'demo@azurebay.com');
  test('Session has organization', !!session.data?.user?.organizationId);

  console.log('\n═══ 2. DASHBOARD PAGES ═══');
  const pages = [
    '/dashboard', '/dashboard/calendar', '/dashboard/bookings', '/dashboard/guests',
    '/dashboard/units', '/dashboard/units/types', '/dashboard/housekeeping',
    '/dashboard/payments', '/dashboard/invoices', '/dashboard/notifications',
    '/dashboard/properties', '/dashboard/rate-plans', '/dashboard/rates',
    '/dashboard/channels', '/dashboard/maintenance', '/dashboard/expenses',
    '/dashboard/reports', '/dashboard/guests-staff', '/dashboard/integrations',
    '/dashboard/security', '/dashboard/settings',
  ];
  for (const p of pages) {
    const r = await page(p);
    test(`Page renders: ${p}`, r.ok);
  }

  console.log('\n═══ 3. PROPERTIES ═══');
  const props = await api('GET', '/api/properties');
  test('List properties', props.ok && Array.isArray(props.data));
  test('Has at least 1 property', props.data?.length > 0);
  const propId = props.data?.[0]?.id;

  // Create
  const newProp = await api('POST', '/api/properties', {
    name: 'Functional Test Hotel', code: `FTH${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
    city: 'Mumbai', state: 'MH', country: 'IN',
  }, 201);
  test('Create property', newProp.ok && newProp.data?.id);
  const newPropId = newProp.data?.id;

  // Update
  if (newPropId) {
    const upd = await api('PATCH', `/api/properties/${newPropId}`, { name: 'Functional Test Hotel Updated' });
    test('Update property', upd.ok);
  }

  // Read single
  if (propId) {
    const detail = await api('GET', `/api/properties/${propId}`);
    test('Get property detail', detail.ok && detail.data?.id === propId);
  }

  console.log('\n═══ 4. UNIT TYPES ═══');
  const types = await api('GET', '/api/unit-types');
  test('List unit types', types.ok && Array.isArray(types.data));

  const newType = await api('POST', '/api/unit-types', { name: 'Func Test Suite' }, 201);
  test('Create unit type', newType.ok && newType.data?.id);
  const typeId = newType.data?.id;

  console.log('\n═══ 5. UNITS ═══');
  const units = await api('GET', '/api/units');
  test('List units', units.ok && Array.isArray(units.data));
  test('Has units', units.data?.length > 0);
  // Find a unit that belongs to the first property
  const unitForProp = units.data?.find((u: any) => u.propertyId === propId);
  const unitId = unitForProp?.id || units.data?.[0]?.id;

  if (newPropId && typeId) {
    const newUnit = await api('POST', '/api/units', {
      propertyId: newPropId, unitTypeId: typeId, name: 'Func Test Room', number: 'FT-101',
    }, 201);
    test('Create unit', newUnit.ok && newUnit.data?.id);
    const newUnitId = newUnit.data?.id;

    if (newUnitId) {
      const updUnit = await api('PATCH', `/api/units/${newUnitId}`, { name: 'Func Test Room Updated', floor: '2' });
      test('Update unit', updUnit.ok);
    }
  }

  console.log('\n═══ 6. GUESTS ═══');
  const guests = await api('GET', '/api/guests');
  test('List guests', guests.ok);
  const guestId = guests.data?.data?.[0]?.id || guests.data?.[0]?.id;

  const newGuest = await api('POST', '/api/guests', {
    firstName: 'Func', lastName: 'Tester', email: `func-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    phone: `+9198765${Date.now().toString().slice(-7)}`, city: 'Mumbai', country: 'IN',
  }, 201);
  test('Create guest', newGuest.ok && newGuest.data?.id);
  const newGuestId = newGuest.data?.id;

  if (newGuestId) {
    const updGuest = await api('PATCH', `/api/guests/${newGuestId}`, { firstName: 'Func Updated' });
    test('Update guest', updGuest.ok);
  }

  console.log('\n═══ 7. RATE PLANS ═══');
  const ratePlans = await api('GET', '/api/rate-plans');
  test('List rate plans', ratePlans.ok);

  const newRatePlan = await api('POST', '/api/rate-plans', {
    name: 'Func Test Plan', basePrice: 2500, minStay: 1, isRefundable: true, mealsIncluded: 'none',
  }, 201);
  test('Create rate plan', newRatePlan.ok && newRatePlan.data?.id);
  const ratePlanId = newRatePlan.data?.id;

  console.log('\n═══ 8. SEASONAL RATES ═══');
  if (ratePlanId) {
    const sr = await api('POST', '/api/seasonal-rates', {
      ratePlanId, name: 'Func Peak', startDate: '2027-03-01', endDate: '2027-03-15',
      price: 3500,
    }, 201);
    test('Create seasonal rate', sr.ok);
  }

  console.log('\n═══ 9. RATE RESTRICTIONS ═══');
  if (ratePlanId) {
    const rr = await api('POST', '/api/rate-restrictions', {
      restrictionType: 'MIN_LOS', minLOS: 2,
      startDate: '2027-03-01', endDate: '2027-03-15',
    }, 201);
    test('Create rate restriction', rr.ok);
  }

  console.log('\n═══ 10. BOOKINGS FULL LIFECYCLE ═══');
  if (propId && guestId && unitId) {
    // Create booking
    const bk = await api('POST', '/api/bookings', {
      propertyId: propId, guestId, unitId,
      arrivalDate: '2028-06-01', departureDate: '2028-06-03',
      adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 12, source: 'DIRECT',
    }, 201);
    test('Create booking', bk.ok && bk.data?.confirmationCode);
    const bookingId = bk.data?.id;
    test('Booking has confirmation code', /^B-/.test(bk.data?.confirmationCode));
    test('Booking total calculated correctly', Number(bk.data?.totalAmount) === 11200);

    if (bookingId) {
      // Pay full amount
      const pay = await api('POST', '/api/payments', {
        bookingId, amount: 11200, method: 'CARD', status: 'PAID', reference: 'FUNC-TEST-001',
      }, 201);
      test('Record payment', pay.ok);

      // Verify balance
      const bkDetail = await api('GET', `/api/bookings/${bookingId}`);
      test('Balance updated after payment', Number(bkDetail.data?.balance) === 0);

      // Check in
      const ci = await api('POST', `/api/bookings/${bookingId}/check-in`);
      test('Check-in succeeds', ci.ok && ci.data?.status === 'CHECKED_IN');
      test('Check-in timestamp set', !!ci.data?.checkedInAt);

      // Check out
      const co = await api('POST', `/api/bookings/${bookingId}/check-out`);
      test('Check-out succeeds', co.ok && co.data?.status === 'CHECKED_OUT');
      test('Check-out timestamp set', !!co.data?.checkedOutAt);

      // Verify unit status changed
      const unitAfter = await api('GET', `/api/units`);
      const u = unitAfter.data?.find(u => u.id === unitId);
      test('Unit marked dirty after checkout', u?.status === 'VACANT_DIRTY');
    }

    // Conflict test: create an active booking, then try to overlap
    const conflictGuest = await api('POST', '/api/guests', {
      firstName: 'Conflict', lastName: 'Guest', email: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      phone: `+9198765${Date.now().toString().slice(-7)}1`,
    }, 201);
    if (conflictGuest.ok) {
      const activeBk = await api('POST', '/api/bookings', {
        propertyId: propId, guestId: conflictGuest.data.id, unitId,
        arrivalDate: '2027-05-01', departureDate: '2027-05-05',
        adults: 1, unitRate: 5000, taxAmount: 12,
      }, 201);
      if (activeBk.ok) {
        const conflict = await api('POST', '/api/bookings', {
          propertyId: propId, guestId: guestId!, unitId,
          arrivalDate: '2027-05-03', departureDate: '2027-05-07',
          adults: 1, unitRate: 5000, taxAmount: 12,
        }, 409);
        test('Double booking rejected', conflict.ok);
      }
    }

    // Past date rejection
    const pastBk = await api('POST', '/api/bookings', {
      propertyId: propId, guestId, unitId,
      arrivalDate: '2025-01-01', departureDate: '2025-01-03',
      adults: 1, unitRate: 5000, taxAmount: 12,
    }, 400);
    test('Past date booking rejected', pastBk.ok);
  }

  console.log('\n═══ 11. HOUSEKEEPING ═══');
  const hk = await api('GET', '/api/housekeeping');
  test('List housekeeping tasks', hk.ok);

  console.log('\n═══ 12. MAINTENANCE ═══');
  const mt = await api('GET', '/api/maintenance');
  test('List maintenance tickets', mt.ok);

  if (unitId) {
    const newMt = await api('POST', '/api/maintenance', {
      unitId, title: 'Func Test Issue', description: 'AC not working properly',
      priority: 'HIGH',
    }, 201);
    test('Create maintenance ticket', newMt.ok);
  }

  console.log('\n═══ 13. PAYMENTS ═══');
  const pays = await api('GET', '/api/payments');
  test('List payments', pays.ok);

  console.log('\n═══ 14. EXPENSES ═══');
  const exps = await api('GET', '/api/expenses');
  test('List expenses', exps.ok);

  const newExp = await api('POST', '/api/expenses', {
    category: 'UTILITIES', description: 'Func test electricity', amount: 1500,
    expenseDate: '2027-04-01',
  }, 201);
  test('Create expense', newExp.ok);

  console.log('\n═══ 15. INVOICES ═══');
  const invs = await api('GET', '/api/invoices');
  test('List invoices', invs.ok);

  console.log('\n═══ 16. NOTIFICATIONS ═══');
  const notifs = await api('GET', '/api/notifications');
  test('List notifications', notifs.ok && notifs.data?.notifications);

  const unread = await api('GET', '/api/notifications/unread-count');
  test('Unread count', unread.ok && typeof unread.data?.count === 'number');

  const markAll = await api('POST', '/api/notifications/mark-all-read');
  test('Mark all as read', markAll.ok);

  console.log('\n═══ 17. INVITATIONS ═══');
  const inv = await api('POST', '/api/invitations', {
    email: `func-staff-${Date.now()}@test.com`, role: 'RECEPTIONIST',
  }, 201);
  test('Create invitation', inv.ok && inv.data?.token);

  const invList = await api('GET', '/api/invitations');
  test('List invitations', invList.ok);

  console.log('\n═══ 18. CHANNELS ═══');
  const channels = await api('GET', '/api/channels');
  test('List channels', channels.ok);

  const newChannel = await api('POST', '/api/channels', {
    name: 'Func Test OTA', type: 'EXPEDIA', markup: 8,
  }, 201);
  test('Create channel', newChannel.ok);

  if (newChannel.data?.id) {
    const toggle = await api('PATCH', `/api/channels/${newChannel.data.id}`, { isEnabled: false });
    test('Toggle channel', toggle.ok);
  }

  console.log('\n═══ 19. WEBHOOKS ═══');
  const hooks = await api('GET', '/api/webhooks');
  test('List webhooks', hooks.ok);

  const newHook = await api('POST', '/api/webhooks', {
    name: 'Func Test Hook', url: 'https://httpbin.org/post', events: ['booking.created'],
  }, 201);
  test('Create webhook', newHook.ok);

  console.log('\n═══ 20. API KEYS ═══');
  const keys = await api('GET', '/api/api-keys');
  test('List API keys', keys.ok);

  const newKey = await api('POST', '/api/api-keys', { name: 'Func Test Key' }, 201);
  test('Create API key', newKey.ok && newKey.data?.key?.startsWith('pms_live_'));
  // Verify full key not returned on GET
  const keysAfter = await api('GET', '/api/api-keys');
  const keyExists = keysAfter.data?.find(k => k.id === newKey.data?.id);
  test('Full key hidden on subsequent GET', keyExists && !keyExists.key);

  console.log('\n═══ 21. INTEGRATIONS ═══');
  const integrations = await api('GET', '/api/integrations');
  test('List integrations', Array.isArray(integrations.data));

  console.log('\n═══ 22. ORGANIZATION ═══');
  const org = await api('GET', '/api/organization');
  test('Get organization', org.ok && org.data?.name);
  test('Org has currency', !!org.data?.currency);
  test('Org has plan', !!org.data?.plan);

  // Currency lock
  const currLock = await api('PATCH', '/api/organization', { currency: 'USD' }, 400);
  test('Currency change to USD blocked', currLock.ok);

  console.log('\n═══ 23. SECURITY ═══');
  const sessions = await api('GET', '/api/sessions');
  test('List sessions', sessions.ok);

  const tfaSetup = await api('POST', '/api/2fa/setup');
  test('2FA setup returns secret', tfaSetup.ok && tfaSetup.data?.secret);

  const tfaBad = await api('POST', '/api/2fa/verify', { code: '000000' }, 400);
  test('Invalid 2FA code rejected', tfaBad.ok);

  console.log('\n═══ 24. REPORTS ═══');
  // Reports use organization data
  const reportOrg = await api('GET', '/api/organization');
  test('Organization data available for reports', reportOrg.ok);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
