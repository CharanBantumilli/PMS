const BASE = 'http://localhost:3000';
let cookies: string[] = [];

async function api(method: string, path: string, body?: any) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; '), origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  const elapsed = performance.now() - start;
  let data: any = null;
  try { data = text ? JSON.parse(text) : null } catch {}
  return { status: res.status, data, elapsed, size: text.length };
}

async function page(path: string) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookies.join('; '), origin: BASE },
    redirect: 'manual',
  });
  const html = await res.text();
  const elapsed = performance.now() - start;
  return { status: res.status, html, elapsed, size: html.length };
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  cookies = (csrfRes.headers.getSetCookie?.() || csrfRes.headers.get('set-cookie')?.split(', ') || []).map(c => c.split(';')[0]);
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken: csrfData.csrfToken, email: 'demo@azurebay.com', password: 'demo1234', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  const rawNC = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie')?.split(', ') || [];
  const newCookies = rawNC.map((c: string) => c.split(';')[0]);
  cookies = [...cookies, ...newCookies];
}

let passed = 0, failed = 0, info = 0;
function ok(name: string, detail?: string) { passed++; console.log(`  PASS ${name}${detail ? ' -- ' + detail : ''}`); }
function fail(name: string, detail?: string) { failed++; console.log(`  FAIL ${name}${detail ? ' -- ' + detail : ''}`); }
function note(name: string, detail?: string) { info++; console.log(`  NOTE ${name}${detail ? ' -- ' + detail : ''}`); }

function median(arr: number[]) { const s = arr.sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function p95(arr: number[]) { const s = arr.sort((a, b) => a - b); return s[Math.floor(s.length * 0.95)]; }
function p99(arr: number[]) { const s = arr.sort((a, b) => a - b); return s[Math.floor(s.length * 0.99)]; }
function avg(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

async function run() {
  await login();

  // ═══════════════════════════════════════════════════════════════════
  // 1. API RESPONSE TIMES (single request)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 1. API RESPONSE TIMES (single request) ===');
  const endpoints = [
    ['GET', '/api/properties'],
    ['GET', '/api/units'],
    ['GET', '/api/guests'],
    ['GET', '/api/rate-plans'],
    ['GET', '/api/bookings'],
    ['GET', '/api/payments'],
    ['GET', '/api/expenses'],
    ['GET', '/api/maintenance'],
    ['GET', '/api/channels'],
    ['GET', '/api/webhooks'],
    ['GET', '/api/api-keys'],
    ['GET', '/api/invitations'],
    ['GET', '/api/notifications'],
    ['GET', '/api/organization'],
    ['GET', '/api/auth/session'],
    ['GET', '/api/housekeeping'],
    ['GET', '/api/seasonal-rates'],
    ['GET', '/api/rate-restrictions'],
  ];

  const apiTimes: { endpoint: string; time: number; size: number }[] = [];
  for (const [method, path] of endpoints) {
    const r = await api(method, path);
    apiTimes.push({ endpoint: `${method} ${path}`, time: r.elapsed, size: r.size });
    if (r.elapsed < 500) ok(`${method} ${path}: ${r.elapsed.toFixed(0)}ms (${(r.size / 1024).toFixed(1)}KB)`);
    else if (r.elapsed < 1000) note(`${method} ${path}: ${r.elapsed.toFixed(0)}ms (slow)`);
    else fail(`${method} ${path}: ${r.elapsed.toFixed(0)}ms (too slow)`);
  }

  console.log('\n  --- API Response Time Summary ---');
  const times = apiTimes.map(e => e.time);
  console.log(`  Median: ${median(times).toFixed(0)}ms`);
  console.log(`  Average: ${avg(times).toFixed(0)}ms`);
  console.log(`  P95: ${p95(times).toFixed(0)}ms`);
  console.log(`  P99: ${p99(times).toFixed(0)}ms`);
  console.log(`  Min: ${Math.min(...times).toFixed(0)}ms`);
  console.log(`  Max: ${Math.max(...times).toFixed(0)}ms`);

  // ═══════════════════════════════════════════════════════════════════
  // 2. PAGE LOAD TIMES
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 2. PAGE LOAD TIMES ===');
  const pagePaths = [
    '/dashboard', '/dashboard/calendar', '/dashboard/bookings',
    '/dashboard/guests', '/dashboard/units', '/dashboard/housekeeping',
    '/dashboard/payments', '/dashboard/expenses', '/dashboard/maintenance',
    '/dashboard/channels', '/dashboard/rate-plans', '/dashboard/rates',
    '/dashboard/properties', '/dashboard/notifications', '/dashboard/invoices',
    '/dashboard/reports', '/dashboard/guests-staff', '/dashboard/integrations',
    '/dashboard/security', '/dashboard/settings', '/dashboard/units/types',
  ];

  const pageTimes: { path: string; time: number; size: number }[] = [];
  for (const p of pagePaths) {
    const r = await page(p);
    pageTimes.push({ path: p, time: r.elapsed, size: r.size });
    if (r.elapsed < 200) ok(`${p}: ${r.elapsed.toFixed(0)}ms (${(r.size / 1024).toFixed(1)}KB)`);
    else if (r.elapsed < 500) note(`${p}: ${r.elapsed.toFixed(0)}ms`);
    else fail(`${p}: ${r.elapsed.toFixed(0)}ms (slow)`);
  }

  console.log('\n  --- Page Load Time Summary ---');
  const pTimes = pageTimes.map(e => e.time);
  console.log(`  Median: ${median(pTimes).toFixed(0)}ms`);
  console.log(`  Average: ${avg(pTimes).toFixed(0)}ms`);
  console.log(`  P95: ${p95(pTimes).toFixed(0)}ms`);
  console.log(`  Min: ${Math.min(...pTimes).toFixed(0)}ms`);
  console.log(`  Max: ${Math.max(...pTimes).toFixed(0)}ms`);

  // ═══════════════════════════════════════════════════════════════════
  // 3. CONCURRENT REQUESTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 3. CONCURRENT REQUESTS ===');

  // 10 concurrent GET requests
  const start10 = performance.now();
  const concurrent10 = Array.from({ length: 10 }, () => api('GET', '/api/properties'));
  const results10 = await Promise.all(concurrent10);
  const elapsed10 = performance.now() - start10;
  const allOk10 = results10.every(r => r.status === 200);
  if (allOk10) ok(`10 concurrent GETs: ${elapsed10.toFixed(0)}ms total, all succeeded`);
  else fail(`10 concurrent GETs: some failed`);

  // 25 concurrent GET requests
  const start25 = performance.now();
  const concurrent25 = Array.from({ length: 25 }, () => api('GET', '/api/units'));
  const results25 = await Promise.all(concurrent25);
  const elapsed25 = performance.now() - start25;
  const allOk25 = results25.every(r => r.status === 200);
  if (allOk25) ok(`25 concurrent GETs: ${elapsed25.toFixed(0)}ms total, all succeeded`);
  else fail(`25 concurrent GETs: some failed`);

  // 50 concurrent GET requests
  const start50 = performance.now();
  const concurrent50 = Array.from({ length: 50 }, () => api('GET', '/api/guests'));
  const results50 = await Promise.all(concurrent50);
  const elapsed50 = performance.now() - start50;
  const okCount50 = results50.filter(r => r.status === 200).length;
  if (okCount50 === 50) ok(`50 concurrent GETs: ${elapsed50.toFixed(0)}ms total, all succeeded`);
  else if (okCount50 > 40) note(`50 concurrent GETs: ${okCount50}/50 succeeded (${elapsed50.toFixed(0)}ms)`, 'Rate limiting may kick in');
  else fail(`50 concurrent GETs: only ${okCount50}/50 succeeded`);

  // Mixed concurrent (different endpoints)
  const startMixed = performance.now();
  const mixed = [
    api('GET', '/api/properties'),
    api('GET', '/api/units'),
    api('GET', '/api/guests'),
    api('GET', '/api/bookings'),
    api('GET', '/api/payments'),
    api('GET', '/api/rate-plans'),
    api('GET', '/api/notifications'),
    api('GET', '/api/organization'),
    api('GET', '/api/channels'),
    api('GET', '/api/expenses'),
  ];
  const mixedResults = await Promise.all(mixed);
  const elapsedMixed = performance.now() - startMixed;
  const allOkMixed = mixedResults.every(r => r.status === 200);
  if (allOkMixed) ok(`10 mixed endpoint GETs: ${elapsedMixed.toFixed(0)}ms total`);
  else fail(`10 mixed endpoint GETs: some failed`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 4. WRITE OPERATIONS ===');
  const props = await api('GET', '/api/properties');
  const propId = props.data?.[0]?.id;
  const units = await api('GET', '/api/units');
  const unitsArr = Array.isArray(units.data) ? units.data : (units.data?.data || []);
  const propUnits = unitsArr.filter((u: any) => u.propertyId === propId);
  const unitId = propUnits[0]?.id;
  const guests = await api('GET', '/api/guests');
  const gArr = Array.isArray(guests.data) ? guests.data : guests.data?.data;
  const guestId = gArr?.[0]?.id;

  const writeTests = [
    { name: 'Create guest', op: () => api('POST', '/api/guests', { firstName: 'Perf', lastName: 'Test', email: `perf-${Date.now()}@test.com`, phone: '+919876543210' }) },
    { name: 'Update guest', op: async () => { const g = await api('POST', '/api/guests', { firstName: 'Perf', lastName: 'Upd', email: `perfupd-${Date.now()}@test.com`, phone: '+919876543211' }); return api('PATCH', `/api/guests/${g.data?.id}`, { firstName: 'Perf Updated' }); } },
    { name: 'Create expense', op: () => api('POST', '/api/expenses', { propertyId: propId, category: 'MAINTENANCE', amount: 100, description: 'Perf test', expenseDate: new Date().toISOString() }) },
    { name: 'Create maintenance', op: () => api('POST', '/api/maintenance', { unitId, title: 'Perf ticket', description: 'Performance test' }) },
    { name: 'Create webhook', op: () => api('POST', '/api/webhooks', { name: 'Perf Hook', url: 'https://example.com', events: ['BOOKING_CREATED'] }) },
    { name: 'Create API key', op: () => api('POST', '/api/api-keys', { name: 'Perf Key', permissions: ['read:bookings'] }) },
  ];

  for (const wt of writeTests) {
    const start = performance.now();
    const r = await wt.op();
    const elapsed = performance.now() - start;
    if (r.status === 201 || r.status === 200) ok(`${wt.name}: ${elapsed.toFixed(0)}ms`);
    else note(`${wt.name}: ${elapsed.toFixed(0)}ms (status ${r.status})`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. RESPONSE PAYLOAD SIZES
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 5. RESPONSE PAYLOAD SIZES ===');
  const sizes = [
    { endpoint: '/api/properties', expected: '<50KB' },
    { endpoint: '/api/units', expected: '<100KB' },
    { endpoint: '/api/guests', expected: '<200KB' },
    { endpoint: '/api/bookings', expected: '<200KB' },
    { endpoint: '/api/payments', expected: '<200KB' },
    { endpoint: '/api/organization', expected: '<5KB' },
    { endpoint: '/api/auth/session', expected: '<5KB' },
    { endpoint: '/api/notifications', expected: '<50KB' },
  ];

  for (const s of sizes) {
    const r = await api('GET', s.endpoint);
    const kb = (r.size / 1024).toFixed(1);
    if (r.size < 50 * 1024) ok(`${s.endpoint}: ${kb}KB`);
    else if (r.size < 200 * 1024) note(`${s.endpoint}: ${kb}KB (large)`);
    else fail(`${s.endpoint}: ${kb}KB (too large)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. REPEATED REQUESTS (caching)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 6. REPEATED REQUESTS (caching) ===');
  const repeatTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await api('GET', '/api/properties');
    repeatTimes.push(r.elapsed);
  }
  const avgRepeat = avg(repeatTimes);
  if (avgRepeat < 200) ok(`5 repeated GETs avg: ${avgRepeat.toFixed(0)}ms (consistent)`);
  else note(`5 repeated GETs avg: ${avgRepeat.toFixed(0)}ms`);

  // ═══════════════════════════════════════════════════════════════════
  // 7. LARGE PAYLOAD HANDLING
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 7. LARGE PAYLOAD HANDLING ===');
  const largeGuest = await api('POST', '/api/guests', {
    firstName: 'A'.repeat(200), lastName: 'B'.repeat(200),
    email: `large-${Date.now()}@test.com`, phone: '+919876543210',
    notes: 'C'.repeat(5000),
  });
  if (largeGuest.status === 201 || largeGuest.status === 400) ok('Large payload handled');
  else fail('Large payload error', `Status ${largeGuest.status}`);

  // ═══════════════════════════════════════════════════════════════════
  // 8. RATE LIMITING BEHAVIOR
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 8. RATE LIMITING BEHAVIOR ===');
  let rateLimitHits = 0;
  const rlStart = performance.now();
  for (let i = 0; i < 20; i++) {
    const r = await api('GET', '/api/properties');
    if (r.status === 429) rateLimitHits++;
  }
  const rlElapsed = performance.now() - rlStart;
  if (rateLimitHits === 0) note('No rate limiting after 20 requests', 'Consider adding for production');
  else ok(`Rate limiting active: ${rateLimitHits}/20 requests limited (${rlElapsed.toFixed(0)}ms)`);

  // ═══════════════════════════════════════════════════════════════════
  // 9. DATABASE QUERY PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 9. DATABASE QUERY PERFORMANCE ===');
  // Complex queries (bookings with joins)
  const dbTests = [
    { name: 'Properties list', op: () => api('GET', '/api/properties') },
    { name: 'Units list', op: () => api('GET', '/api/units') },
    { name: 'Guests list (paginated)', op: () => api('GET', '/api/guests') },
    { name: 'Bookings list', op: () => api('GET', '/api/bookings') },
    { name: 'Payments list', op: () => api('GET', '/api/payments') },
    { name: 'Expenses list', op: () => api('GET', '/api/expenses') },
    { name: 'Housekeeping list', op: () => api('GET', '/api/housekeeping') },
    { name: 'Notifications list', op: () => api('GET', '/api/notifications') },
  ];

  const dbTimes: number[] = [];
  for (const dt of dbTests) {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await dt.op();
      times.push(r.elapsed);
    }
    const avgTime = avg(times);
    dbTimes.push(avgTime);
    if (avgTime < 200) ok(`${dt.name}: avg ${avgTime.toFixed(0)}ms (3 runs)`);
    else if (avgTime < 500) note(`${dt.name}: avg ${avgTime.toFixed(0)}ms`);
    else fail(`${dt.name}: avg ${avgTime.toFixed(0)}ms (slow)`);
  }

  console.log('\n  --- DB Query Performance Summary ---');
  console.log(`  Overall avg: ${avg(dbTimes).toFixed(0)}ms`);
  console.log(`  Slowest: ${Math.max(...dbTimes).toFixed(0)}ms`);
  console.log(`  Fastest: ${Math.min(...dbTimes).toFixed(0)}ms`);

  // ═══════════════════════════════════════════════════════════════════
  // 10. STRESS TEST (burst)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n=== 10. STRESS TEST (burst) ===');
  const burstStart = performance.now();
  const burst = Array.from({ length: 30 }, (_, i) =>
    i % 3 === 0 ? api('GET', '/api/properties') :
    i % 3 === 1 ? api('GET', '/api/units') :
    api('GET', '/api/guests')
  );
  const burstResults = await Promise.all(burst);
  const burstElapsed = performance.now() - burstStart;
  const burstOk = burstResults.filter(r => r.status === 200).length;
  if (burstOk === 30) ok(`Burst 30 requests: ${burstElapsed.toFixed(0)}ms, ${burstOk}/30 succeeded`);
  else if (burstOk > 20) note(`Burst 30 requests: ${burstElapsed.toFixed(0)}ms, ${burstOk}/30 succeeded`);
  else fail(`Burst 30 requests: ${burstElapsed.toFixed(0)}ms, ${burstOk}/30 succeeded`);

  // ═══════════════════════════════════════════════════════════════════
  // OVERALL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n========================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${info} info`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
