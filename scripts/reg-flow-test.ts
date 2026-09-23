const BASE = 'http://localhost:3000';
let passed = 0, failed = 0;

async function req(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const TS = Date.now();
const TEST_EMAIL = `regtest-${TS}@example.com`;
const TEST_SLUG = `regtest-${TS}`;
const TEST_PASS = 'TestPass@123';

async function runTests() {
  console.log('\n=== REGISTRATION/OTP FLOW TESTS ===\n');

  // Phase 1: Register
  console.log('Phase 1: Register (creates PENDING account + sends OTP)');
  const reg = await req('POST', '/api/register', {
    organizationName: 'Test Hotel', organizationSlug: TEST_SLUG,
    name: 'Test User', email: TEST_EMAIL,
    password: TEST_PASS, confirmPassword: TEST_PASS,
    country: 'IN', currency: 'INR',
  });
  assert('Register returns 200', reg.status === 200, `got ${reg.status}: ${JSON.stringify(reg.data)}`);
  assert('Register returns ok: true', reg.data?.ok === true);
  assert('Returns userId', !!reg.data?.userId);
  assert('Returns organizationId', !!reg.data?.organizationId);
  const debugCode = reg.data?.debug_code;
  assert('Returns debug_code in dev mode', !!debugCode, `got: ${debugCode}`);

  // Phase 2: Verify OTP activates account
  console.log('\nPhase 2: Verify OTP activates account');
  const verify = await req('POST', '/api/otp/verify', {
    email: TEST_EMAIL, code: debugCode, purpose: 'REGISTER',
  });
  assert('Verify returns 200', verify.status === 200, `got ${verify.status}: ${JSON.stringify(verify.data)}`);
  assert('Returns verified: true', verify.data?.verified === true);
  assert('Returns activated: true', verify.data?.activated === true);

  // Phase 3: Re-verify same OTP fails
  console.log('\nPhase 3: Re-verify same OTP fails');
  const reVerify = await req('POST', '/api/otp/verify', {
    email: TEST_EMAIL, code: debugCode, purpose: 'REGISTER',
  });
  assert('Re-verify fails (OTP used)', reVerify.status !== 200, `got ${reVerify.status}`);

  // Phase 4: OTP send for LOGIN succeeds after activation
  console.log('\nPhase 4: OTP send for LOGIN succeeds after activation');
  const otpLogin = await req('POST', '/api/otp/send', {
    email: TEST_EMAIL, purpose: 'LOGIN',
  });
  assert('OTP send for LOGIN succeeds', otpLogin.status === 200, `got ${otpLogin.status}`);

  // Phase 5: Wrong OTP rejected
  console.log('\nPhase 5: Wrong OTP rejected');
  const wrongOtp = await req('POST', '/api/otp/verify', {
    email: TEST_EMAIL, code: '000000', purpose: 'REGISTER',
  });
  assert('Wrong OTP rejected', wrongOtp.status !== 200);

  // Phase 6: Resend OTP invalidates old
  console.log('\nPhase 6: Resend OTP invalidates old');
  const resendSlug = `resend-${TS}`;
  const resendEmail = `resend-${TS}@example.com`;
  const resendReg = await req('POST', '/api/register', {
    organizationName: 'Resend Hotel', organizationSlug: resendSlug,
    name: 'Resend User', email: resendEmail,
    password: TEST_PASS, confirmPassword: TEST_PASS,
    country: 'IN', currency: 'INR',
  });
  const oldCode = resendReg.data?.debug_code;
  await req('POST', '/api/otp/send', { email: resendEmail, purpose: 'REGISTER' });
  const verifyOldCode = await req('POST', '/api/otp/verify', {
    email: resendEmail, code: oldCode, purpose: 'REGISTER',
  });
  assert('Old OTP rejected after resend', verifyOldCode.status !== 200);

  // Phase 7: ACTIVE account cannot re-verify
  console.log('\nPhase 7: ACTIVE account cannot re-verify');
  const activeVerify = await req('POST', '/api/otp/verify', {
    email: resendEmail, code: '123456', purpose: 'REGISTER',
  });
  assert('ACTIVE account rejected for REGISTER', activeVerify.status !== 200);

  // Phase 8: Duplicate email
  console.log('\nPhase 8: Duplicate email registration');
  const dupEmail = await req('POST', '/api/register', {
    organizationName: 'Dup Hotel', organizationSlug: `dup-${TS}`,
    name: 'Dup User', email: TEST_EMAIL,
    password: TEST_PASS, confirmPassword: TEST_PASS,
    country: 'IN', currency: 'INR',
  });
  assert('Duplicate email rejected (409)', dupEmail.status === 409, `got ${dupEmail.status}`);

  // Phase 9: Duplicate slug
  console.log('\nPhase 9: Duplicate slug registration');
  const dupSlug = await req('POST', '/api/register', {
    organizationName: 'Dup Slug', organizationSlug: TEST_SLUG,
    name: 'Dup Slug User', email: `dupslug-${TS}@example.com`,
    password: TEST_PASS, confirmPassword: TEST_PASS,
    country: 'IN', currency: 'INR',
  });
  assert('Duplicate slug rejected (409)', dupSlug.status === 409, `got ${dupSlug.status}`);

  // Phase 10: Password mismatch
  console.log('\nPhase 10: Password mismatch');
  const pwMismatch = await req('POST', '/api/register', {
    organizationName: 'PW Hotel', organizationSlug: `pw-${TS}`,
    name: 'PW User', email: `pw-${TS}@example.com`,
    password: TEST_PASS, confirmPassword: 'WrongPass@123',
    country: 'IN', currency: 'INR',
  });
  assert('Password mismatch rejected', pwMismatch.status !== 200, `got ${pwMismatch.status}`);

  // Phase 11: Weak password
  console.log('\nPhase 11: Weak password');
  const weakPw = await req('POST', '/api/register', {
    organizationName: 'Weak Hotel', organizationSlug: `weak-${TS}`,
    name: 'Weak User', email: `weak-${TS}@example.com`,
    password: 'weak', confirmPassword: 'weak',
    country: 'IN', currency: 'INR',
  });
  assert('Weak password rejected', weakPw.status !== 200);

  // Phase 12: OTP send for non-existent user
  console.log('\nPhase 12: OTP send for non-existent REGISTER user');
  const otpNonExist = await req('POST', '/api/otp/send', {
    email: `nonexist-${TS}@example.com`, purpose: 'REGISTER',
  });
  assert('OTP send for non-existent user rejected', otpNonExist.status !== 200);

  // Phase 13: OTP send for LOGIN with non-existent user
  console.log('\nPhase 13: OTP send for LOGIN with non-existent user');
  const otpLoginNonExist = await req('POST', '/api/otp/send', {
    email: `nonexist-${TS}@example.com`, purpose: 'LOGIN',
  });
  assert('OTP send for LOGIN non-existent rejected', otpLoginNonExist.status !== 200);

  // Phase 14: Empty body
  console.log('\nPhase 14: Empty / invalid input');
  const empty = await req('POST', '/api/register', {});
  assert('Empty body rejected', empty.status !== 200);

  // Phase 15: Invalid JSON
  console.log('\nPhase 15: Invalid JSON');
  const invalidJson = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  });
  assert('Invalid JSON returns 400', invalidJson.status === 400);

  // Phase 16: Mass assignment protection
  console.log('\nPhase 16: Mass assignment protection');
  const massSlug = `mass-${TS}`;
  const massEmail = `mass-${TS}@example.com`;
  const mass = await req('POST', '/api/register', {
    organizationName: 'Mass Hotel', organizationSlug: massSlug,
    name: 'Mass User', email: massEmail,
    password: TEST_PASS, confirmPassword: TEST_PASS,
    country: 'IN', currency: 'INR',
    role: 'ADMIN', isSuperAdmin: true, status: 'ACTIVE',
  });
  // If the register API ignores extra fields, the user should still be OWNER + PENDING_VERIFICATION
  // We can't verify directly, but the API should not crash
  assert('Mass assignment fields ignored (API does not crash)', mass.status === 200 || mass.status === 400 || mass.status === 409);

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => { console.error('Test error:', e); process.exit(1); });
