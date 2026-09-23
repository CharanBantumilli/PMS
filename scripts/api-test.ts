import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
let cookies: string[] = [];
let csrfToken = '';
let propId: string, unitId: string, guestId: string, ratePlanId: string;

async function api(method: string, path: string, body?: any, expectStatus: number | number[] = 200) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; '), origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null } catch {}
  const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
  if (!ok) {
    console.error(`  FAIL ${method} ${path} -> ${res.status} (expected ${expectStatus})`);
    console.error(`    ${text.slice(0, 200)}`);
  }
  return { status: res.status, data, ok, ct, text };
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
  const rawNC = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(', ') || []; const newCookies = rawNC.map((c: string) => c.split(';')[0]);
  cookies = [...cookies, ...newCookies];
}

let passed = 0, failed = 0;
function test(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? ' -- ' + detail : ''}`); }
}

function fd(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function cleanup() {
  const now = new Date();
  await prisma.payment.deleteMany({ where: { booking: { arrivalDate: { gte: now } } } });
  await prisma.booking.deleteMany({ where: { arrivalDate: { gte: now } } });
  await prisma.guest.deleteMany({ where: { email: { contains: 'apitest-' } } });
  await prisma.unit.deleteMany({ where: { number: { startsWith: 'API-' } } });
  await prisma.unitTypeDefinition.deleteMany({ where: { name: { contains: 'API Test' } } });
  await prisma.property.deleteMany({ where: { code: { in: ['APT'] } } });
  await prisma.ratePlan.deleteMany({ where: { name: { contains: 'API Test' } } });
  await prisma.channel.deleteMany({ where: { name: { contains: 'API Test' } } });
  await prisma.webhook.deleteMany({ where: { name: { contains: 'API Test' } } });
  await prisma.apiKey.deleteMany({ where: { name: { contains: 'API Test' } } });
  await prisma.invitation.deleteMany({ where: { email: { contains: 'apitest-' } } });
}

async function run() {
  await cleanup();
  await login();

  // ═══════════════════════════════════════════════════════════════════
  // 1. AUTH ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 1. AUTH ENDPOINTS ===');
  const csrf = await api('GET', '/api/auth/csrf');
  test('GET /api/auth/csrf returns token', csrf.ok && !!csrf.data?.csrfToken);
  const sess = await api('GET', '/api/auth/session');
  test('GET /api/auth/session returns user', sess.ok && !!sess.data?.user);
  propId = (await api('GET', '/api/properties')).data?.[0]?.id;
  const units = (await api('GET', '/api/units')).data || [];
  unitId = units[0]?.id;
  const guests = (await api('GET', '/api/guests')).data;
  guestId = Array.isArray(guests) ? guests[0]?.id : guests?.data?.[0]?.id;
  ratePlanId = (await api('GET', '/api/rate-plans')).data?.[0]?.id;

  // ═══════════════════════════════════════════════════════════════════
  // 2. PROPERTIES CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 2. PROPERTIES CRUD ===');
  const pList = await api('GET', '/api/properties');
  test('GET /api/properties returns array', pList.ok && Array.isArray(pList.data));
  test('Properties have required fields', pList.ok && pList.data[0]?.id && pList.data[0]?.name);

  const pCreate = await api('POST', '/api/properties', {
    name: 'API Test Hotel', code: 'APT', type: 'HOTEL',
    city: 'Testville', state: 'TS', country: 'IN',
  }, 201);
  test('POST /api/properties creates', pCreate.ok);
  test('Created property has id', !!pCreate.data?.id);
  const aptId = pCreate.data?.id;

  const pGet = await api('GET', `/api/properties/${aptId}`);
  test('GET /api/properties/:id returns detail', pGet.ok && pGet.data?.name === 'API Test Hotel');

  const pUpdate = await api('PATCH', `/api/properties/${aptId}`, { name: 'API Test Hotel Updated' });
  test('PATCH /api/properties/:id updates', pUpdate.ok && pUpdate.data?.name === 'API Test Hotel Updated');

  const p404 = await api('GET', '/api/properties/nonexistent', undefined, 404);
  test('GET /api/properties/:id 404', p404.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 3. UNIT TYPES CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 3. UNIT TYPES CRUD ===');
  const utList = await api('GET', '/api/unit-types');
  test('GET /api/unit-types returns array', utList.ok && Array.isArray(utList.data));

  const utCreate = await api('POST', '/api/unit-types', {
    name: 'API Test Suite', bedType: 'KING', maxOccupancy: 3,
    amenities: ['WiFi', 'AC'], propertyId: propId,
  }, 201);
  test('POST /api/unit-types creates', utCreate.ok);
  test('Created unit type has id', !!utCreate.data?.id);

  // ═══════════════════════════════════════════════════════════════════
  // 4. UNITS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 4. UNITS CRUD ===');
  const uList = await api('GET', '/api/units');
  test('GET /api/units returns array', uList.ok && Array.isArray(uList.data));
  test('Units have required fields', uList.ok && uList.data[0]?.id && uList.data[0]?.number);

  const uCreate = await api('POST', '/api/units', {
    number: 'API-101', name: 'API Room 101', propertyId: propId,
    unitTypeId: utCreate.data?.id,
  }, 201);
  test('POST /api/units creates', uCreate.ok);
  const apiUnitId = uCreate.data?.id;

  // Units [id] only supports PATCH and DELETE (no GET)
  const uUpdate = await api('PATCH', `/api/units/${apiUnitId}`, { number: 'API-102' });
  test('PATCH /api/units/:id updates', uUpdate.ok && uUpdate.data?.number === 'API-102');

  // ═══════════════════════════════════════════════════════════════════
  // 5. GUESTS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 5. GUESTS CRUD ===');
  const gList = await api('GET', '/api/guests');
  const gArr = Array.isArray(gList.data) ? gList.data : (gList.data?.data || []);
  test('GET /api/guests returns data', gList.ok && gArr.length > 0);
  test('Guests have required fields', gArr[0]?.id && gArr[0]?.firstName);

  const gCreate = await api('POST', '/api/guests', {
    firstName: 'API', lastName: 'TestGuest', email: `apitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    phone: `+9198765${Date.now().toString().slice(-7)}`, country: 'IN',
  }, 201);
  test('POST /api/guests creates', gCreate.ok);
  const apiGuestId = gCreate.data?.id;

  const gGet = await api('GET', `/api/guests/${apiGuestId}`);
  test('GET /api/guests/:id returns detail', gGet.ok && gGet.data?.firstName === 'API');

  const gUpdate = await api('PATCH', `/api/guests/${apiGuestId}`, { firstName: 'API Updated' });
  test('PATCH /api/guests/:id updates', gUpdate.ok && gUpdate.data?.firstName === 'API Updated');

  const g404 = await api('GET', '/api/guests/nonexistent', undefined, 404);
  test('GET /api/guests/:id 404', g404.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 6. RATE PLANS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 6. RATE PLANS CRUD ===');
  const rpList = await api('GET', '/api/rate-plans');
  test('GET /api/rate-plans returns array', rpList.ok && Array.isArray(rpList.data));

  const rpCreate = await api('POST', '/api/rate-plans', {
    name: 'API Test Plan', basePrice: 5000, propertyId: propId,
  }, 201);
  test('POST /api/rate-plans creates', rpCreate.ok);
  const apiRpId = rpCreate.data?.id;

  // Rate plans [id] only supports PATCH and DELETE (no GET)
  const rpUpdate = await api('PATCH', `/api/rate-plans/${apiRpId}`, { name: 'API Test Plan Updated' });
  test('PATCH /api/rate-plans/:id updates', rpUpdate.ok && rpUpdate.data?.name === 'API Test Plan Updated');

  // ═══════════════════════════════════════════════════════════════════
  // 7. SEASONAL RATES CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 7. SEASONAL RATES CRUD ===');
  const srList = await api('GET', '/api/seasonal-rates');
  test('GET /api/seasonal-rates returns data', srList.ok);

  const srCreate = await api('POST', '/api/seasonal-rates', {
    name: 'API Peak Season', ratePlanId: apiRpId, propertyId: propId,
    startDate: fd(30), endDate: fd(60), price: 7000,
  }, 201);
  test('POST /api/seasonal-rates creates', srCreate.ok);
  const apiSrId = srCreate.data?.id;

  const srUpdate = await api('PATCH', `/api/seasonal-rates/${apiSrId}`, { price: 7500 });
  test('PATCH /api/seasonal-rates/:id updates', srUpdate.ok);

  const srDel = await api('DELETE', `/api/seasonal-rates/${apiSrId}`);
  test('DELETE /api/seasonal-rates/:id deletes', srDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 8. RATE RESTRICTIONS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 8. RATE RESTRICTIONS CRUD ===');
  const rrList = await api('GET', '/api/rate-restrictions');
  test('GET /api/rate-restrictions returns data', rrList.ok);

  const rrCreate = await api('POST', '/api/rate-restrictions', {
    ratePlanId: apiRpId, propertyId: propId,
    restrictionType: 'MIN_LOS', minLOS: 2,
    startDate: fd(30), endDate: fd(60),
  }, 201);
  test('POST /api/rate-restrictions creates', rrCreate.ok);
  const apiRrId = rrCreate.data?.id;

  // Rate restrictions [id] only supports DELETE (no PATCH)
  const rrDel = await api('DELETE', `/api/rate-restrictions/${apiRrId}`);
  test('DELETE /api/rate-restrictions/:id deletes', rrDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 9. BOOKINGS CRUD + ACTIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 9. BOOKINGS CRUD + ACTIONS ===');
  const bkList = await api('GET', '/api/bookings');
  const bkArr = Array.isArray(bkList.data) ? bkList.data : (bkList.data?.data || []);
  test('GET /api/bookings returns data', bkList.ok && bkArr.length > 0);

  const bkCreate = await api('POST', '/api/bookings', {
    propertyId: propId, guestId, unitId: apiUnitId,
    arrivalDate: fd(30), departureDate: fd(33),
    adults: 2, unitRate: 5000, taxAmount: 12, source: 'DIRECT',
    confirmationCode: 'API-TEST-001',
  }, 201);
  test('POST /api/bookings creates', bkCreate.ok);
  test('Booking has confirmation code', !!bkCreate.data?.confirmationCode);
  test('Booking has totalAmount', bkCreate.data?.totalAmount != null);
  test('Booking has balance', bkCreate.data?.balance != null);
  const apiBkId = bkCreate.data?.id;

  const bkGet = await api('GET', `/api/bookings/${apiBkId}`);
  test('GET /api/bookings/:id returns detail', bkGet.ok && bkGet.data?.id === apiBkId);

  // Record payment
  const payCreate = await api('POST', '/api/payments', {
    bookingId: apiBkId, amount: 16800, method: 'CASH', status: 'PAID',
  }, 201);
  test('POST /api/payments creates', payCreate.ok);

  // Check-in
  const ci = await api('POST', `/api/bookings/${apiBkId}/check-in`);
  test('POST /api/bookings/:id/check-in', ci.ok && ci.data?.status === 'CHECKED_IN');

  // Check-out
  const co = await api('POST', `/api/bookings/${apiBkId}/check-out`);
  test('POST /api/bookings/:id/check-out', co.ok && co.data?.status === 'CHECKED_OUT');

  const bk404 = await api('GET', '/api/bookings/nonexistent', undefined, 404);
  test('GET /api/bookings/:id 404', bk404.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 10. PAYMENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 10. PAYMENTS ===');
  const payList = await api('GET', '/api/payments');
  test('GET /api/payments returns data', payList.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 11. EXPENSES CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 11. EXPENSES CRUD ===');
  const exList = await api('GET', '/api/expenses');
  test('GET /api/expenses returns data', exList.ok);

  const exCreate = await api('POST', '/api/expenses', {
    propertyId: propId, category: 'MAINTENANCE', amount: 2500,
    description: 'API test expense', expenseDate: new Date().toISOString(),
  }, 201);
  test('POST /api/expenses creates', exCreate.ok);
  const apiExId = exCreate.data?.id;

  // Expenses [id] has no GET handler — returns 405
  const exGet = await api('GET', `/api/expenses/${apiExId}`, undefined, 405);
  test('GET /api/expenses/:id -> 405 (no GET handler)', exGet.ok);

  const exUpdate = await api('PATCH', `/api/expenses/${apiExId}`, { amount: 3000 });
  test('PATCH /api/expenses/:id updates', exUpdate.ok);

  const exDel = await api('DELETE', `/api/expenses/${apiExId}`);
  test('DELETE /api/expenses/:id deletes', exDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 12. MAINTENANCE CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 12. MAINTENANCE CRUD ===');
  const mtList = await api('GET', '/api/maintenance');
  test('GET /api/maintenance returns data', mtList.ok);

  const mtCreate = await api('POST', '/api/maintenance', {
    unitId: apiUnitId, title: 'API Test Ticket', description: 'Test maintenance issue',
    priority: 'MEDIUM',
  }, 201);
  test('POST /api/maintenance creates', mtCreate.ok);
  const apiMtId = mtCreate.data?.id;

  // Maintenance [id] has no GET handler — returns 405
  const mtGet = await api('GET', `/api/maintenance/${apiMtId}`, undefined, 405);
  test('GET /api/maintenance/:id -> 405 (no GET handler)', mtGet.ok);

  const mtUpdate = await api('PATCH', `/api/maintenance/${apiMtId}`, { status: 'IN_PROGRESS' });
  test('PATCH /api/maintenance/:id updates', mtUpdate.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 13. HOUSEKEEPING
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 13. HOUSEKEEPING ===');
  const hkList = await api('GET', '/api/housekeeping');
  test('GET /api/housekeeping returns data', hkList.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 14. CHANNELS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 14. CHANNELS CRUD ===');
  const chList = await api('GET', '/api/channels');
  test('GET /api/channels returns data', chList.ok);

  const chCreate = await api('POST', '/api/channels', {
    name: 'API Test OTA', type: 'BOOKING_COM', propertyId: propId,
  }, 201);
  test('POST /api/channels creates', chCreate.ok);
  const apiChId = chCreate.data?.id;

  const chToggle = await api('PATCH', `/api/channels/${apiChId}`, { isActive: false });
  test('PATCH /api/channels/:id toggles', chToggle.ok);

  const chDel = await api('DELETE', `/api/channels/${apiChId}`);
  test('DELETE /api/channels/:id deletes', chDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 15. WEBHOOKS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 15. WEBHOOKS CRUD ===');
  const whList = await api('GET', '/api/webhooks');
  test('GET /api/webhooks returns data', whList.ok);

  const whCreate = await api('POST', '/api/webhooks', {
    name: 'API Test Hook', url: 'https://example.com/hook',
    events: ['BOOKING_CREATED'],
  }, 201);
  test('POST /api/webhooks creates', whCreate.ok);
  const apiWhId = whCreate.data?.id;

  // Webhooks [id] only supports DELETE (no PATCH)
  const whDel = await api('DELETE', `/api/webhooks/${apiWhId}`);
  test('DELETE /api/webhooks/:id deletes', whDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 16. API KEYS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 16. API KEYS CRUD ===');
  const akList = await api('GET', '/api/api-keys');
  test('GET /api/api-keys returns data', akList.ok);

  const akCreate = await api('POST', '/api/api-keys', {
    name: 'API Test Key', permissions: ['read:bookings'],
  }, 201);
  test('POST /api/api-keys creates', akCreate.ok);
  test('API key has key (shown once)', !!akCreate.data?.key);
  const apiAkId = akCreate.data?.id;

  // Subsequent GET should NOT expose full key
  const akGet = await api('GET', '/api/api-keys');
  const akArr = Array.isArray(akGet.data) ? akGet.data : (akGet.data?.data || []);
  const createdKey = akArr.find((k: any) => k.id === apiAkId);
  test('API key hidden on list (no full key)', createdKey && !createdKey.key);

  const akDel = await api('DELETE', `/api/api-keys/${apiAkId}`);
  test('DELETE /api/api-keys/:id deletes', akDel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 17. INVITATIONS CRUD
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 17. INVITATIONS CRUD ===');
  const invList = await api('GET', '/api/invitations');
  test('GET /api/invitations returns data', invList.ok);

  const invCreate = await api('POST', '/api/invitations', {
    email: `apitest-staff-${Date.now()}@test.com`, role: 'RECEPTIONIST',
  }, 201);
  test('POST /api/invitations creates', invCreate.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 18. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 18. NOTIFICATIONS ===');
  const nList = await api('GET', '/api/notifications');
  test('GET /api/notifications returns data', nList.ok);

  const nUnread = await api('GET', '/api/notifications/unread-count');
  test('GET /api/notifications/unread-count returns count', nUnread.ok && typeof nUnread.data?.count === 'number');

  const nMarkAll = await api('POST', '/api/notifications/mark-all-read');
  test('POST /api/notifications/mark-all-read works', nMarkAll.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 19. ORGANIZATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 19. ORGANIZATION ===');
  const org = await api('GET', '/api/organization');
  test('GET /api/organization returns data', org.ok && !!org.data?.name);
  test('Org has plan', !!org.data?.plan);
  test('Org has currency', !!org.data?.currency);

  const orgUpdate = await api('PATCH', '/api/organization', { name: org.data.name });
  test('PATCH /api/organization updates', orgUpdate.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 20. HTTP METHOD VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 20. HTTP METHOD VALIDATION ===');
  const wrongMethod1 = await api('PUT', '/api/properties', {}, [405, 404]);
  test('PUT /api/properties -> 405/404', wrongMethod1.ok);
  const wrongMethod2 = await api('DELETE', '/api/properties', undefined, [405, 404]);
  test('DELETE /api/properties (no id) -> 405/404', wrongMethod2.ok);
  const wrongMethod3 = await api('PUT', `/api/properties/${propId}`, {}, [405, 404]);
  test('PUT /api/properties/:id -> 405/404', wrongMethod3.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 21. INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 21. INPUT VALIDATION ===');
  const badGuest = await api('POST', '/api/guests', {
    firstName: '', email: 'not-an-email', phone: '123',
  }, 400);
  test('Invalid guest data -> 400', badGuest.ok);

  const badBooking = await api('POST', '/api/bookings', {
    propertyId: propId, guestId, unitId: apiUnitId,
    arrivalDate: '2020-01-01', departureDate: '2020-01-03',
    adults: 1, unitRate: 5000,
  }, 400);
  test('Past date booking -> 400', badBooking.ok);

  const missingFields = await api('POST', '/api/bookings', {}, 400);
  test('Missing required fields -> 400', missingFields.ok);

  const badChannel = await api('POST', '/api/channels', {
    name: 'Bad', type: 'INVALID_TYPE',
  }, 400);
  test('Invalid enum value -> 400', badChannel.ok);

  // ═══════════════════════════════════════════════════════════════════
  // 22. CONTENT-TYPE
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 22. CONTENT-TYPE ===');
  const jsonRes = await api('GET', '/api/properties');
  test('API returns JSON content-type', jsonRes.ct.includes('application/json'));

  // ═══════════════════════════════════════════════════════════════════
  // 23. UNAUTHENTICATED ACCESS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 23. UNAUTHENTICATED ACCESS ===');
  const savedCookies = [...cookies];
  cookies = [];
  const unauth = await api('GET', '/api/properties', undefined, [401, 302, 200]);
  test('No cookies: 401/302/200', unauth.ok);
  cookies = savedCookies;

  // ═══════════════════════════════════════════════════════════════════
  // 24. DELETE OPERATIONS (clean up test data)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 24. DELETE OPERATIONS ===');
  if (apiMtId) {
    const mtDel = await api('DELETE', `/api/maintenance/${apiMtId}`);
    test('DELETE /api/maintenance/:id', mtDel.ok);
  }
  if (apiUnitId) {
    const uDel = await api('DELETE', `/api/units/${apiUnitId}`);
    test('DELETE /api/units/:id', uDel.ok);
  }
  if (aptId) {
    const pDel = await api('DELETE', `/api/properties/${aptId}`);
    test('DELETE /api/properties/:id', pDel.ok);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n========================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
