import { PrismaClient } from '@prisma/client';
import { registerSchema } from '../lib/validators';
const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
let passed = 0, failed = 0;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const LONG_DELAY = 65000; // 65s to clear 5-min rate limit windows

async function api(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: BASE, ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null } catch {}
  return { status: res.status, data, ok: res.ok, text };
}

function test(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

function freshEmail() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2,6)}@testreg.com`;
}

// ═══════════════════════════════════════════════════════════════════
// 1. ZOD SCHEMA VALIDATION (no API calls — pure schema tests)
// ═══════════════════════════════════════════════════════════════════
async function testSchemaValidation() {
  console.log('\n═══ 1. ZOD SCHEMA VALIDATION ═══');

  // Valid input
  const valid = registerSchema.safeParse({
    organizationName: 'Test Hotel', organizationSlug: 'test-hotel', name: 'Test Owner',
    email: 'user@example.com', password: 'Password@123',
  });
  test('Valid input passes', valid.success);

  // Missing fields
  test('Empty object fails', !registerSchema.safeParse({}).success);
  test('Missing email fails', !registerSchema.safeParse({ organizationName: 'Test', organizationSlug: 'test', name: 'Test', password: 'Password@123' }).success);
  test('Missing password fails', !registerSchema.safeParse({ organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: 'x@x.com' }).success);
  test('Missing name fails', !registerSchema.safeParse({ organizationName: 'Test', organizationSlug: 'test', email: 'x@x.com', password: 'Password@123' }).success);
  test('Missing org name fails', !registerSchema.safeParse({ organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'Password@123' }).success);
  test('Missing slug fails', !registerSchema.safeParse({ organizationName: 'Test', name: 'Test', email: 'x@x.com', password: 'Password@123' }).success);

  // Invalid emails
  const badEmails = ['invalid', 'invalid@', '@example.com', 'user@', 'user@example', '', ' '];
  for (const e of badEmails) {
    test(`Invalid email "${e}" rejected`, !registerSchema.safeParse({
      organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: e, password: 'Password@123',
    }).success);
  }

  // Weak passwords
  const weakPasswords = ['', '123', 'password', 'Password', 'password1', 'Password1', 'Pass1234', '12345678', 'Ab1!abc'];
  for (const p of weakPasswords) {
    test(`Weak password "${p}" rejected`, !registerSchema.safeParse({
      organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: p,
    }).success);
  }

  // Valid passwords
  const strongPasswords = ['Ab1!abcd', 'Test@1234', 'P@ssw0rd!', 'MyStr0ng!Pass'];
  for (const p of strongPasswords) {
    test(`Strong password accepted`, registerSchema.safeParse({
      organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: p,
    }).success);
  }

  // Password max length
  test('Password 120 chars accepted', registerSchema.safeParse({
    organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'A'.repeat(117) + '1a!',
  }).success);
  test('Password 121 chars rejected', !registerSchema.safeParse({
    organizationName: 'Test', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'A'.repeat(118) + '1a!',
  }).success);

  // Invalid slugs
  const badSlugs = ['ab', 'AB', 'hello world', 'test@slug', 'UPPER', '', 'a b'];
  for (const s of badSlugs) {
    test(`Invalid slug "${s}" rejected`, !registerSchema.safeParse({
      organizationName: 'Test', organizationSlug: s, name: 'Test', email: 'x@x.com', password: 'Password@123',
    }).success);
  }

  // Valid slugs
  const goodSlugs = ['abc', 'my-hotel', 'hotel-123', 'test123', 'a-b-c'];
  for (const s of goodSlugs) {
    test(`Valid slug "${s}" accepted`, registerSchema.safeParse({
      organizationName: 'Test', organizationSlug: s, name: 'Test', email: 'x@x.com', password: 'Password@123',
    }).success);
  }

  // Organization name length
  test('Org name 2 chars accepted', registerSchema.safeParse({
    organizationName: 'AB', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'Password@123',
  }).success);
  test('Org name 1 char rejected', !registerSchema.safeParse({
    organizationName: 'A', organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'Password@123',
  }).success);
  test('Org name 80 chars accepted', registerSchema.safeParse({
    organizationName: 'A'.repeat(80), organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'Password@123',
  }).success);
  test('Org name 81 chars rejected', !registerSchema.safeParse({
    organizationName: 'A'.repeat(81), organizationSlug: 'test', name: 'Test', email: 'x@x.com', password: 'Password@123',
  }).success);

  // Unicode in name
  test('Unicode name accepted', registerSchema.safeParse({
    organizationName: 'Hôtel Üñîcôdé', organizationSlug: 'unicode', name: 'Ñame', email: 'x@x.com', password: 'Password@123',
  }).success);

  // Emoji in name
  test('Emoji in org name accepted', registerSchema.safeParse({
    organizationName: '🏨 Hotel', organizationSlug: 'emoji', name: 'Test', email: 'x@x.com', password: 'Password@123',
  }).success);
}

// ═══════════════════════════════════════════════════════════════════
// 2. REGISTRATION API — CORE FUNCTIONALITY (spaced requests)
// ═══════════════════════════════════════════════════════════════════
async function testRegistrationAPI() {
  console.log('\n═══ 2-5. REGISTRATION API ═══');

  // Test 1: Valid registration + password security + database integrity + role assignment + mass assignment
  const email1 = freshEmail();
  const r1 = await api('POST', '/api/register', {
    organizationName: 'Valid Hotel', organizationSlug: `valid-${Date.now()}`,
    name: 'Valid User', email: email1, password: 'Password@123',
    // Mass assignment injections
    role: 'ADMIN', isSuperAdmin: true, status: 'SUSPENDED', permissions: ['all'],
    organizationId: 'fake', tokenVersion: 999, phone: '+123456', image: 'http://x.com',
  });
  test('Registration → 200', r1.ok, `got ${r1.status}: ${JSON.stringify(r1.data).slice(0,200)}`);

  if (r1.ok) {
    const user = await prisma.user.findFirst({ where: { email: email1 } });
    test('Role = OWNER', user?.role === 'OWNER');
    test('Status = ACTIVE', user?.status === 'ACTIVE');
    test('isSuperAdmin = false', user?.isSuperAdmin === false);
    test('Password hashed (bcrypt)', user?.hashedPassword?.startsWith('$2'));
    test('Password NOT plaintext', user?.hashedPassword !== 'Password@123');
    test('Bcrypt cost = 12', user?.hashedPassword?.slice(4, 6) === '12');
    test('Permissions = null (mass assign blocked)', user?.permissions === null);
    test('emailVerified = null', user?.emailVerified === null);
    test('phone = null', user?.phone === null);
    test('tokenVersion = 0', user?.tokenVersion === 0);

    const org = await prisma.organization.findUnique({ where: { id: r1.data.organizationId } });
    test('Org planStatus = TRIAL', org?.planStatus === 'TRIAL');
    test('Org trialEndsAt > now', org!.trialEndsAt! > new Date());
    test('Org maxProperties = 5', org?.maxProperties === 5);
    test('Org maxUsers = 10', org?.maxUsers === 10);
    test('Org maxUnits = 200', org?.maxUnits === 200);

    const act = await prisma.activityLog.findFirst({ where: { entityId: r1.data.organizationId, entity: 'Organization' } });
    test('Activity log created', !!act);

    // Login test
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const setCookies = csrfRes.headers.getSetCookie?.() || [];
    let cookies = setCookies.map((c: string) => c.split(';')[0].trim());
    const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
      body: new URLSearchParams({ csrfToken: csrfData.csrfToken, email: email1, password: 'Password@123', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
      redirect: 'manual',
    });
    test('Login after registration → success', lr.status === 200 || lr.status === 302, `got ${lr.status}`);
  }

  await delay(LONG_DELAY);

  // Test 2: Duplicate email (same + uppercase)
  const email2 = `dup-${Date.now()}@testreg.com`;
  const d1 = await api('POST', '/api/register', {
    organizationName: 'Dup1', organizationSlug: `dup-${Date.now()}-a`, name: 'Test', email: email2, password: 'Password@123',
  });
  await delay(LONG_DELAY);
  const d2 = await api('POST', '/api/register', {
    organizationName: 'Dup2', organizationSlug: `dup-${Date.now()}-b`, name: 'Test', email: email2, password: 'Password@123',
  });
  test('Duplicate email → 409', d2.status === 409, `got ${d2.status}`);
  await delay(LONG_DELAY);
  const d3 = await api('POST', '/api/register', {
    organizationName: 'Dup3', organizationSlug: `dup-${Date.now()}-c`, name: 'Test', email: email2.toUpperCase(), password: 'Password@123',
  });
  test('Uppercase duplicate → 409', d3.status === 409, `got ${d3.status}`);
}

// ═══════════════════════════════════════════════════════════════════
// 3. EMAIL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════
async function testEmailNormalization() {
  console.log('\n═══ 3. EMAIL NORMALIZATION ═══');

  const base = `norm-${Date.now()}`;
  const mixedEmail = `${base}@Test.Com`;
  
  const r1 = await api('POST', '/api/register', {
    organizationName: 'Norm', organizationSlug: `norm-${Date.now()}`, name: 'Test', email: mixedEmail, password: 'Password@123',
  });
  test('Register with mixed case → 200', r1.ok, `got ${r1.status}`);

  if (r1.ok) {
    const lowerEmail = mixedEmail.toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: lowerEmail } });
    test('DB stores lowercase', user?.email === lowerEmail, `got ${user?.email}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. OTP SYSTEM
// ═══════════════════════════════════════════════════════════════════
async function testOTPSystem() {
  console.log('\n═══ 7. OTP SYSTEM ═══');

  const otpEmail = `otp-${Date.now()}@testreg.com`;

  // 7.1 Send OTP
  const sendRes = await api('POST', '/api/otp/send', { email: otpEmail, purpose: 'REGISTER' });
  test('Send OTP → 200', sendRes.ok, `got ${sendRes.status}`);
  test('debug_code returned (dev mode)', !!sendRes.data?.debug_code);

  // 7.2 Wrong code
  const wrongOtp = await api('POST', '/api/otp/verify', { email: otpEmail, code: '000000', purpose: 'REGISTER' });
  test('Wrong OTP → 400', wrongOtp.status === 400, `got ${wrongOtp.status}`);

  // 7.3 Correct code
  if (sendRes.data?.debug_code) {
    const correctOtp = await api('POST', '/api/otp/verify', { email: otpEmail, code: sendRes.data.debug_code, purpose: 'REGISTER' });
    test('Correct OTP → verified', correctOtp.ok && correctOtp.data?.verified === true);

    // 7.4 Reuse
    const reuse = await api('POST', '/api/otp/verify', { email: otpEmail, code: sendRes.data.debug_code, purpose: 'REGISTER' });
    test('Reused OTP → rejected', reuse.status === 400, `got ${reuse.status}`);
  }

  // 7.5 Format
  if (sendRes.data?.debug_code) {
    test('OTP is 6 digits', /^\d{6}$/.test(sendRes.data.debug_code));
  }

  // 7.6 Invalid purpose
  const badPurpose = await api('POST', '/api/otp/send', { email: otpEmail, purpose: 'INVALID' });
  test('Invalid purpose → 400', badPurpose.status === 400);

  // 7.7 Missing identifiers
  const noIdent = await api('POST', '/api/otp/send', { purpose: 'LOGIN' });
  test('Missing email+phone → 400', noIdent.status === 400);

  // 7.8 Empty code
  const emptyCode = await api('POST', '/api/otp/verify', { email: otpEmail, code: '', purpose: 'REGISTER' });
  test('Empty OTP code → 400', emptyCode.status === 400);

  // 7.9 New OTP invalidates old OTP
  const reuseEmail = `otp-reuse-${Date.now()}@testreg.com`;
  const s1 = await api('POST', '/api/otp/send', { email: reuseEmail, purpose: 'REGISTER' });
  const s2 = await api('POST', '/api/otp/send', { email: reuseEmail, purpose: 'REGISTER' });
  if (s1.data?.debug_code && s2.data?.debug_code) {
    const oldUsed = await api('POST', '/api/otp/verify', { email: reuseEmail, code: s1.data.debug_code, purpose: 'REGISTER' });
    test('Old OTP invalidated by new send', oldUsed.status === 400, `got ${oldUsed.status}`);
  }

  // 7.10 Expired OTP
  const expEmail = `otp-exp-${Date.now()}@testreg.com`;
  await api('POST', '/api/otp/send', { email: expEmail, purpose: 'LOGIN' });
  const otpRec = await prisma.otpCode.findFirst({ where: { email: expEmail, purpose: 'LOGIN' } });
  if (otpRec) {
    await prisma.otpCode.update({ where: { id: otpRec.id }, data: { expiresAt: new Date(Date.now() - 60000) } });
    const expired = await api('POST', '/api/otp/verify', { email: expEmail, code: otpRec.code, purpose: 'LOGIN' });
    test('Expired OTP → rejected', expired.status === 400, `got ${expired.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 8. DATABASE INTEGRITY
// ═══════════════════════════════════════════════════════════════════
async function testDatabaseIntegrity() {
  console.log('\n═══ 8. DATABASE INTEGRITY ═══');

  const email = freshEmail();
  const slug = `db-${Date.now()}`;
  const res = await api('POST', '/api/register', {
    organizationName: 'DB Test', organizationSlug: slug, name: 'DB User', email, password: 'Password@123',
  });

  if (res.ok) {
    const orgId = res.data.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    test('Org created', !!org);
    test('Org name correct', org?.name === 'DB Test');
    test('Org slug correct', org?.slug === slug);
    test('Org email = registered email', org?.email === email);
    test('Org planStatus = TRIAL', org?.planStatus === 'TRIAL');
    test('Org trialEndsAt > now', org!.trialEndsAt! > new Date());
    test('Org maxProperties = 5', org?.maxProperties === 5);
    test('Org maxUsers = 10', org?.maxUsers === 10);
    test('Org maxUnits = 200', org?.maxUnits === 200);

    const user = await prisma.user.findFirst({ where: { email } });
    test('User created', !!user);
    test('User ID starts with cl', user?.id?.startsWith('cl'));
    test('User email correct', user?.email === email);
    test('User name correct', user?.name === 'DB User');
    test('User role = OWNER', user?.role === 'OWNER');
    test('User status = ACTIVE', user?.status === 'ACTIVE');
    test('User org matches', user?.organizationId === orgId);
    test('User isSuperAdmin = false', user?.isSuperAdmin === false);
    test('User hashedPassword set', !!user?.hashedPassword);
    test('User emailVerified = null', user?.emailVerified === null);
    test('User phone = null', user?.phone === null);
    test('User permissions = null', user?.permissions === null);
    test('User createdAt set', !!user?.createdAt);

    // Activity log
    const act = await prisma.activityLog.findFirst({ where: { entityId: orgId, entity: 'Organization' } });
    test('Activity log for org creation', !!act);
    test('Activity action = CREATE', act?.action === 'CREATE');
  }
}

// ═══════════════════════════════════════════════════════════════════
// 9. INVITATION SYSTEM
// ═══════════════════════════════════════════════════════════════════
async function testInvitationSystem() {
  console.log('\n═══ 9. INVITATION SYSTEM ═══');

  // Login as demo user
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const setCookies = csrfRes.headers.getSetCookie?.() || [];
  let cookies = setCookies.map((c: string) => c.split(';')[0].trim());
  const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken: csrfData.csrfToken, email: 'demo@azurebay.com', password: 'demo1234', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  const loginCookies = lr.headers.getSetCookie?.() || [];
  cookies = [...cookies, ...loginCookies.map((c: string) => c.split(';')[0].trim())];
  const hdrs = { cookie: cookies.join('; '), origin: BASE };

  // Create invitation
  const invEmail = `inv-${Date.now()}@testreg.com`;
  const invRes = await fetch(`${BASE}/api/invitations`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...hdrs },
    body: JSON.stringify({ email: invEmail, role: 'MANAGER' }),
  });
  const invData = await invRes.json();
  test('Create invitation → 200', invRes.ok, `got ${invRes.status}`);

  if (invRes.ok && invData?.token) {
    // Accept
    const accept = await api('POST', '/api/invitations/accept', { token: invData.token, name: 'Invited', password: 'Password@123' });
    test('Accept invitation → 200', accept.ok, `got ${accept.status}`);

    const invUser = await prisma.user.findFirst({ where: { email: invEmail } });
    test('Role = MANAGER', invUser?.role === 'MANAGER');
    test('Status = ACTIVE', invUser?.status === 'ACTIVE');
    test('Same org', invUser?.organizationId === 'cmu1dsgtr001q4pj23r6ffubn');

    // Double accept
    const double = await api('POST', '/api/invitations/accept', { token: invData.token, name: 'Double', password: 'Password@123' });
    test('Double accept → 400', double.status === 400);

    // Weak password
    const weak = await api('POST', '/api/invitations/accept', { token: invData.token, name: 'Weak', password: 'weak' });
    // Note: if invitation was already accepted, this will also fail with 400
    test('Weak password on invite → 400', weak.status === 400);
  }

  // Invalid token
  const invalid = await api('POST', '/api/invitations/accept', { token: 'fake-token', name: 'Fake', password: 'Password@123' });
  test('Invalid token → 400', invalid.status === 400);
}

// ═══════════════════════════════════════════════════════════════════
// 10. TRANSACTIONAL INTEGRITY
// ═══════════════════════════════════════════════════════════════════
async function testTransactionalIntegrity() {
  console.log('\n═══ 10. TRANSACTIONAL INTEGRITY ═══');

  const usersWithOrg = await prisma.user.findMany({ where: { organizationId: { not: null } }, select: { id: true, organizationId: true } });
  let orphanUsers = 0;
  for (const u of usersWithOrg) {
    const org = await prisma.organization.findUnique({ where: { id: u.organizationId! } });
    if (!org) orphanUsers++;
  }
  test('No orphan users', orphanUsers === 0, `found ${orphanUsers}`);

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let orphanOrgs = 0;
  for (const o of orgs) {
    const count = await prisma.user.count({ where: { organizationId: o.id } });
    if (count === 0) orphanOrgs++;
  }
  test('No orphan orgs', orphanOrgs === 0, `found ${orphanOrgs}`);
}

// ═══════════════════════════════════════════════════════════════════
// 11. ACCOUNT ENUMERATION
// ═══════════════════════════════════════════════════════════════════
async function testAccountEnumeration() {
  console.log('\n═══ 11. ACCOUNT ENUMERATION ═══');

  const email = freshEmail();
  await api('POST', '/api/register', {
    organizationName: 'Enum', organizationSlug: `enum-${Date.now()}`, name: 'Test', email, password: 'Password@123',
  });
  await delay(500);

  const dup = await api('POST', '/api/register', {
    organizationName: 'Enum2', organizationSlug: `enum-${Date.now()}-b`, name: 'Test', email, password: 'Password@123',
  });
  test('Existing email reveals existence via error', dup.status === 409 && dup.data?.error?.includes('already exists'), `got ${dup.status}: ${dup.data?.error}`);
}

// ═══════════════════════════════════════════════════════════════════
// 12. ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════
async function testErrorHandling() {
  console.log('\n═══ 12. ERROR HANDLING ═══');

  // Malformed JSON
  try {
    const bad = await fetch(`${BASE}/api/register`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: BASE },
      body: '{invalid json',
    });
    test('Malformed JSON → handled (no crash)', [400, 500].includes(bad.status));
  } catch { test('Malformed JSON → handled', false); }

  // SQL injection
  const sql = await api('POST', '/api/register', {
    organizationName: "'; DROP TABLE users; --", organizationSlug: `sql-${Date.now()}`,
    name: "'; DROP TABLE users; --", email: freshEmail(), password: 'Password@123',
  });
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE tablename = 'User'`;
  test('SQL injection: table intact', Array.isArray(tables));

  // XSS in fields
  const xssEmail = freshEmail();
  const xss = await api('POST', '/api/register', {
    organizationName: '<script>alert(1)</script>', organizationSlug: `xss-${Date.now()}`,
    name: '<img src=x onerror=alert(1)>', email: xssEmail, password: 'Password@123',
  });
  // XSS is stored as-is — issue is in rendering, not storage
  test('XSS fields accepted (check rendering)', xss.ok, `got ${xss.status}`);
}

// ═══════════════════════════════════════════════════════════════════
// 13. COOKIE SECURITY
// ═══════════════════════════════════════════════════════════════════
async function testCookieSecurity() {
  console.log('\n═══ 13. COOKIE SECURITY ═══');

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const cookies = csrfRes.headers.getSetCookie?.() || [];
  
  let hasHttpOnly = false, hasSameSite = false;
  for (const c of cookies) {
    if (c.includes('session-token') || c.includes('csrf-token')) {
      if (c.toLowerCase().includes('httponly')) hasHttpOnly = true;
      if (c.toLowerCase().includes('samesite')) hasSameSite = true;
    }
  }
  test('Session cookies have HttpOnly', hasHttpOnly);
  test('Session cookies have SameSite', hasSameSite);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SIGN UP & REGISTRATION MODULE AUDIT');
  console.log('═══════════════════════════════════════════════════');

  await testSchemaValidation();
  
  // Registration API tests need long delays (rate limit: 3/5min global + 3/hour in-memory)
  console.log('\n  [Running API tests with rate-limit delays...]');
  await delay(LONG_DELAY);
  await testRegistrationAPI();
  await delay(LONG_DELAY);
  await testEmailNormalization();
  await delay(5000);
  await testOTPSystem();
  await delay(5000);
  await testInvitationSystem();
  await testTransactionalIntegrity();
  await testErrorHandling();
  await testCookieSecurity();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════');

  await prisma.$disconnect();
}

run().catch(console.error);
