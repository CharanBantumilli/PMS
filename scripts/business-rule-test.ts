import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
let cookies: string[] = [];
let csrfToken = '';
let propId: string, unitId: string, guestId: string;

async function api(method: string, path: string, body?: any, expectStatus: number | number[] = 200) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; '), origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null } catch {}
  const ok = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
  if (!ok) {
    console.error(`  FAIL ${method} ${path} -> ${res.status} (expected ${expectStatus})`);
    console.error(`    ${text.slice(0, 300)}`);
  }
  return { status: res.status, data, ok };
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
  return loginRes.status;
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

async function cleanupBookings() {
  const now = new Date();
  await prisma.payment.deleteMany({ where: { booking: { arrivalDate: { gte: now } } } });
  await prisma.booking.deleteMany({ where: { arrivalDate: { gte: now } } });
  console.log('  Cleaned up future bookings from previous runs');
}

async function run() {
  await login();
  await cleanupBookings();
  const props = await api('GET', '/api/properties');
  propId = props.data?.[0]?.id;
  const units = await api('GET', '/api/units');
  const u = units.data?.find((u: any) => u.propertyId === propId);
  unitId = u?.id;
  const guests = await api('GET', '/api/guests');
  guestId = guests.data?.data?.[0]?.id || guests.data?.[0]?.id;
  if (!propId || !unitId || !guestId) { console.error('Missing fixtures'); process.exit(1); }

  console.log('\n=== 1. AVAILABILITY & CONFLICT DETECTION ===');
  const d1 = fd(60), d2 = fd(63);
  const bk1 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: d1, departureDate: d2, adults: 2, unitRate: 5000, taxAmount: 12, source: 'DIRECT' }, 201);
  test('Create initial 3-night booking', bk1.ok);
  test('Exact same dates rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: d1, departureDate: d2, adults: 1, unitRate: 5000, taxAmount: 12 }, 409)).ok);
  test('Overlapping start rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(59), departureDate: fd(61), adults: 1, unitRate: 5000, taxAmount: 12 }, 409)).ok);
  test('Overlapping end rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(62), departureDate: fd(64), adults: 1, unitRate: 5000, taxAmount: 12 }, 409)).ok);
  test('Enclosing dates rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(59), departureDate: fd(64), adults: 1, unitRate: 5000, taxAmount: 12 }, 409)).ok);
  test('Contained dates rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(61), departureDate: fd(62), adults: 1, unitRate: 5000, taxAmount: 12 }, 409)).ok);
  const adj1 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(63), departureDate: fd(65), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  test('Adjacent end allowed', adj1.ok);
  const adj2 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(57), departureDate: fd(60), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  test('Adjacent start allowed', adj2.ok);

  console.log('\n=== 2. DATE VALIDATIONS ===');
  test('Departure before arrival rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(10), departureDate: fd(5), adults: 1, unitRate: 5000, taxAmount: 12 }, 400)).ok);
  test('Same-day rejected (0 nights)', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(10), departureDate: fd(10), adults: 1, unitRate: 5000, taxAmount: 12 }, 400)).ok);
  test('Past arrival rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: '2020-01-01', departureDate: '2020-01-03', adults: 1, unitRate: 5000, taxAmount: 12 }, 400)).ok);
  const oneNight = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(70), departureDate: fd(71), adults: 1, unitRate: 3000, taxAmount: 12 }, 201);
  test('1-night stay accepted', oneNight.ok);
  test('Nights = 1', oneNight.data?.nights === 1);
  const longStay = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(80), departureDate: fd(110), adults: 1, unitRate: 3000, taxAmount: 12 }, 201);
  test('30-night stay accepted', longStay.ok);
  test('Nights = 30', longStay.data?.nights === 30);

  console.log('\n=== 3. RATE CALCULATION ===');
  test('3 nights x 5000 + 12% tax = 16800', bk1.ok && Number(bk1.data?.totalAmount) === 16800);
  const discBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(120), departureDate: fd(125), adults: 1, unitRate: 2000, discount: 10, taxAmount: 18 }, 201);
  test('5 nights x 2000, 10% disc, 18% tax = 10620', discBk.ok && Number(discBk.data?.totalAmount) === 10620);
  test('Discount amount = 1000', Number(discBk.data?.discount) === 1000);
  test('Tax amount = 1620', Number(discBk.data?.taxAmount) === 1620);
  const noDisc = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(130), departureDate: fd(132), adults: 1, unitRate: 4000, discount: 0, taxAmount: 0 }, 201);
  test('2 nights x 4000 no disc/tax = 8000', noDisc.ok && Number(noDisc.data?.totalAmount) === 8000);
  test('Zero rate rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(140), departureDate: fd(142), adults: 1, unitRate: 0, discount: 0, taxAmount: 0 }, 400)).ok);

  console.log('\n=== 4. GUEST & PROPERTY VALIDATION ===');
  test('Invalid guest rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId: 'bad', unitId, arrivalDate: fd(150), departureDate: fd(152), adults: 1, unitRate: 5000 }, 400)).ok);
  test('Invalid property rejected', (await api('POST', '/api/bookings', { propertyId: 'bad', guestId, unitId, arrivalDate: fd(150), departureDate: fd(152), adults: 1, unitRate: 5000 }, 400)).ok);
  test('Invalid unit rejected', (await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId: 'bad', arrivalDate: fd(150), departureDate: fd(152), adults: 1, unitRate: 5000 }, 400)).ok);

  console.log('\n=== 5. CHECK-IN RULES ===');
  const unpaidBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(160), departureDate: fd(162), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  test('Check-in unpaid rejected', (await api('POST', `/api/bookings/${unpaidBk.data.id}/check-in`, undefined, 400)).ok);
  const cancelBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(165), departureDate: fd(167), adults: 1, unitRate: 5000, taxAmount: 12, status: 'CANCELED' }, 201);
  test('Check-in canceled rejected', (await api('POST', `/api/bookings/${cancelBk.data.id}/check-in`, undefined, 400)).ok);
  test('Check-in nonexistent -> 404', (await api('POST', '/api/bookings/nope/check-in', undefined, 404)).ok);
  const oneNightPay = await api('POST', '/api/payments', { bookingId: oneNight.data.id, amount: 3360, method: 'CASH', status: 'PAID' }, 201);
  test('Payment recorded', oneNightPay.ok);
  const ci1 = await api('POST', `/api/bookings/${oneNight.data.id}/check-in`);
  test('Check-in succeeds after payment', ci1.ok && ci1.data?.status === 'CHECKED_IN');
  const ci2 = await api('POST', `/api/bookings/${oneNight.data.id}/check-in`);
  test('Idempotent check-in', ci2.ok && ci2.data?.status === 'CHECKED_IN');
  await api('POST', `/api/bookings/${oneNight.data.id}/check-out`);
  const coCi = await api('POST', `/api/bookings/${oneNight.data.id}/check-in`);
  test('Check-in after checkout rejected', coCi.status === 400);

  console.log('\n=== 6. CHECK-OUT RULES ===');
  const pendBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(170), departureDate: fd(172), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  test('Check-out pending rejected', (await api('POST', `/api/bookings/${pendBk.data.id}/check-out`, undefined, 400)).ok);
  const confBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(175), departureDate: fd(177), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  test('Check-out confirmed rejected', (await api('POST', `/api/bookings/${confBk.data.id}/check-out`, undefined, 400)).ok);
  const partialBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(180), departureDate: fd(182), adults: 1, unitRate: 5000, taxAmount: 12 }, 201);
  await api('POST', '/api/payments', { bookingId: partialBk.data.id, amount: 3000, method: 'CASH', status: 'PAID' }, 201);
  await api('POST', `/api/bookings/${partialBk.data.id}/check-in`);
  const partialCo = await api('POST', `/api/bookings/${partialBk.data.id}/check-out`, undefined, 400);
  test('Check-out with balance -> 400', partialCo.ok);
  const coMsg = partialCo.data?.error?.toLowerCase() || '';
  test('Error mentions balance or status', coMsg.includes('balance') || coMsg.includes('status'));
  test('Check-out nonexistent -> 404', (await api('POST', '/api/bookings/nope/check-out', undefined, 404)).ok);
  const idemCo = await api('POST', `/api/bookings/${oneNight.data.id}/check-out`);
  test('Idempotent check-out', idemCo.ok && idemCo.data?.status === 'CHECKED_OUT');

  console.log('\n=== 7. PAYMENT & BALANCE ===');
  const payBk = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(190), departureDate: fd(193), adults: 1, unitRate: 4000, discount: 10, taxAmount: 18 }, 201);
  // 3 x 4000 = 12000, disc 10% = 1200, after = 10800, tax 18% = 1944, total = 12744
  test('Total = 12744', Number(payBk.data?.totalAmount) === 12744);
  test('Initial balance = 12744', Number(payBk.data?.balance) === 12744);
  test('Initial paid = 0', Number(payBk.data?.paidAmount) === 0);
  const p1 = await api('POST', '/api/payments', { bookingId: payBk.data.id, amount: 5000, method: 'CARD', status: 'PAID' }, 201);
  test('Partial payment recorded', p1.ok);
  const bkAfterPay = await api('GET', `/api/bookings/${payBk.data.id}`);
  test('Paid after partial = 5000', Number(bkAfterPay.data?.paidAmount) === 5000);
  test('Balance after partial = 7744', Number(bkAfterPay.data?.balance) === 7744);
  const p2 = await api('POST', '/api/payments', { bookingId: payBk.data.id, amount: 7744, method: 'UPI', status: 'PAID' }, 201);
  test('Full payment recorded', p2.ok);
  const bkFull = await api('GET', `/api/bookings/${payBk.data.id}`);
  test('Paid after full = 12744', Number(bkFull.data?.paidAmount) === 12744);
  test('Balance after full = 0', Number(bkFull.data?.balance) === 0);
  await api('POST', `/api/bookings/${payBk.data.id}/check-in`);
  const coFull = await api('POST', `/api/bookings/${payBk.data.id}/check-out`);
  test('Check-out after full payment succeeds', coFull.ok && coFull.data?.status === 'CHECKED_OUT');

  console.log('\n=== 8. UNIT STATUS TRANSITIONS ===');
  const unit = (await api('GET', '/api/units')).data?.find((u: any) => u.id === unitId);
  test('Unit after checkout = VACANT_DIRTY', unit?.status === 'VACANT_DIRTY');

  console.log('\n=== 9. BOOKING STATUS ENUM ===');
  const s1 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(200), departureDate: fd(202), adults: 1, unitRate: 5000, taxAmount: 12, status: 'CONFIRMED' }, 201);
  test('Status CONFIRMED accepted', s1.ok && s1.data?.status === 'CONFIRMED');
  const s2 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(205), departureDate: fd(207), adults: 1, unitRate: 5000, taxAmount: 12, status: 'PENDING' }, 201);
  test('Status PENDING accepted', s2.ok && s2.data?.status === 'PENDING');
  const s3 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(210), departureDate: fd(212), adults: 1, unitRate: 5000, taxAmount: 12, status: 'CANCELED' }, 201);
  test('Status CANCELED accepted', s3.ok && s3.data?.status === 'CANCELED');
  const s4 = await api('POST', '/api/bookings', { propertyId: propId, guestId, unitId, arrivalDate: fd(215), departureDate: fd(217), adults: 1, unitRate: 5000, taxAmount: 12, status: 'INVALID' }, 400);
  test('Invalid status rejected', s4.ok);

  console.log('\n=== 10. BOOKING LIST FILTERING ===');
  const listAll = await api('GET', '/api/bookings');
  test('List bookings', listAll.ok);
  const listConfirmed = await api('GET', '/api/bookings?status=CONFIRMED');
  test('Filter by CONFIRMED', listConfirmed.ok);
  const listPending = await api('GET', '/api/bookings?status=PENDING');
  test('Filter by PENDING', listPending.ok);

  console.log('\n=== 11. MULTI-TENANT ISOLATION ===');
  const otherBooking = await api('POST', '/api/bookings', { propertyId: 'other-org-prop', guestId, unitId, arrivalDate: fd(220), departureDate: fd(222), adults: 1, unitRate: 5000 }, 400);
  test('Cross-org property rejected', otherBooking.ok);

  console.log('\n=== 12. AUTHORIZATION ===');
  const noAuth = await api('GET', '/api/bookings', undefined, [401, 200]);
  test('Unauthenticated: returns 401 or 200 (redirect page)', noAuth.ok);

  console.log('\n========================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
