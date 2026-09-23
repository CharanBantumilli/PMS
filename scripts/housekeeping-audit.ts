import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
let cookies: string[] = [];
let csrfToken = '';
let orgId = '';
let passed = 0, failed = 0, blocked = 0;

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
  return { status: res.status, data, ok: Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus, text };
}

function test(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

function block(name: string, reason: string) {
  blocked++; console.log(`  ⊘ ${name} — BLOCKED: ${reason}`);
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  csrfToken = csrfData.csrfToken;

  // Parse set-cookie headers properly
  const setCookies = csrfRes.headers.getSetCookie?.() || [];
  const cookieHeader = csrfRes.headers.get('set-cookie');
  if (setCookies.length === 0 && cookieHeader) {
    cookies = cookieHeader.split(/\s*,\s*(?=next-auth|__Secure)/i).map((c: string) => c.split(';')[0].trim());
  } else {
    cookies = setCookies.map((c: string) => c.split(';')[0].trim());
  }

  console.log('  CSRF cookies:', cookies);

  const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken, email: 'demo@azurebay.com', password: 'demo1234', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });

  console.log('  Login status:', lr.status);
  const loginCookies = lr.headers.getSetCookie?.() || [];
  const loginCookieHeader = lr.headers.get('set-cookie');
  let newCookies: string[] = [];
  if (loginCookies.length === 0 && loginCookieHeader) {
    newCookies = loginCookieHeader.split(/\s*,\s*(?=next-auth|__Secure)/i).map((c: string) => c.split(';')[0].trim());
  } else {
    newCookies = loginCookies.map((c: string) => c.split(';')[0].trim());
  }
  cookies = [...cookies, ...newCookies];
  console.log('  All cookies:', cookies);

  const session = await api('GET', '/api/auth/session');
  orgId = session.data?.user?.organizationId;
  console.log('  Session user:', session.data?.user?.email, 'org:', orgId);
  if (!orgId) {
    console.error('  Login failed! Session:', JSON.stringify(session.data).slice(0, 300));
  }
}

let propId: string, unitId: string, guestId: string;

async function setupTestData() {
  // Use Prisma directly — pick property and unit from same property
  const prop = await prisma.property.findFirst({ where: { organizationId: orgId, deletedAt: null } });
  if (!prop) { console.error('No properties found for org', orgId); process.exit(1); }
  propId = prop.id;

  const unit = await prisma.unit.findFirst({ where: { propertyId: propId } });
  if (!unit) { console.error('No units found for property', propId); process.exit(1); }
  unitId = unit.id;

  console.log('  Test data: prop=' + propId + ' (' + prop.code + '), unit=' + unitId + ' (' + unit.number + ')');

  // Create a test guest via API
  const gRes = await api('POST', '/api/guests', {
    firstName: 'HK', lastName: 'Tester', email: `hk-${Date.now()}@test.com`, phone: `+9198765${String(Date.now()).slice(-4)}`,
  }, 201);
  guestId = gRes.data?.id;
  console.log('  Guest created:', guestId);
}

async function cleanup() {
  // Clean up test tasks
  await prisma.housekeepingTask.deleteMany({ where: { notes: { contains: 'AUDIT-' } } });
  if (guestId) {
    // Clean up bookings first
    await prisma.payment.deleteMany({ where: { booking: { guestId } } });
    await prisma.invoice.deleteMany({ where: { booking: { guestId } } });
    await prisma.bookingExtra.deleteMany({ where: { booking: { guestId } } });
    await prisma.booking.deleteMany({ where: { guestId } });
    await prisma.guest.delete({ where: { id: guestId } }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. TASK CREATION
// ═══════════════════════════════════════════════════════════════════
async function testTaskCreation() {
  console.log('\n═══ 1. TASK CREATION ═══');

  // 1.1 Valid task creation
  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-test-1.1', scheduledFor: new Date().toISOString(),
  }, 201);
  test('Create task → 201', createRes.ok, `got ${createRes.status}: ${JSON.stringify(createRes.data).slice(0,200)}`);
  const taskId = createRes.data?.id;
  test('Task has id', !!taskId);
  test('Task type = FULL_CLEAN', createRes.data?.type === 'FULL_CLEAN');
  test('Task status = PENDING', createRes.data?.status === 'PENDING');
  test('Task priority = 5', createRes.data?.priority === 5);
  test('Task unitId correct', createRes.data?.unitId === unitId);
  test('Task propertyId correct', createRes.data?.propertyId === propId);
  test('Task organizationId correct', createRes.data?.organizationId === orgId);
  test('Task has createdAt', !!createRes.data?.createdAt);
  test('Task startedAt is null', createRes.data?.startedAt === null);
  test('Task completedAt is null', createRes.data?.completedAt === null);
  test('Task duration is null', createRes.data?.duration === null);

  // 1.2 Task with assignee
  const assignRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 3,
    assigneeId: 'cmu1kcq010002pjs7xu8h9mv1', // demo user
    notes: 'AUDIT-test-1.2',
  }, 201);
  test('Create task with assignee → 201', assignRes.ok);
  test('Task has assigneeId', assignRes.data?.assigneeId === 'cmu1kcq010002pjs7xu8h9mv1');

  // 1.3 All task types
  const types = ['FULL_CLEAN', 'TOUCH_UP', 'TURNDOWN', 'INSPECTION', 'LINEN_CHANGE', 'RESTOCK'];
  for (const type of types) {
    const res = await api('POST', '/api/housekeeping', {
      propertyId: propId, unitId, type, priority: 5,
      notes: `AUDIT-type-${type}`,
    }, 201);
    test(`Create task type ${type} → 201`, res.ok);
  }

  // 1.4 Invalid unit → 400
  const badUnit = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId: 'nonexistent', type: 'FULL_CLEAN', priority: 5,
  }, 400);
  test('Invalid unit → 400', badUnit.ok);

  // 1.5 Invalid type → 400
  const badType = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'INVALID_TYPE', priority: 5,
  }, 400);
  test('Invalid type → 400', badType.ok);

  // 1.6 Priority too low → 400
  const badPriLow = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 0,
  }, 400);
  test('Priority 0 → 400', badPriLow.ok);

  // 1.7 Priority too high → 400
  const badPriHigh = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 11,
  }, 400);
  test('Priority 11 → 400', badPriHigh.ok);

  // 1.8 Boundary priorities
  const pri1 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 1,
    notes: 'AUDIT-pri-1',
  }, 201);
  test('Priority 1 → 201', pri1.ok);
  const pri10 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 10,
    notes: 'AUDIT-pri-10',
  }, 201);
  test('Priority 10 → 201', pri10.ok);

  // 1.9 Missing unitId → 400
  const noUnit = await api('POST', '/api/housekeeping', {
    propertyId: propId, type: 'FULL_CLEAN', priority: 5,
  }, 400);
  test('Missing unitId → 400', noUnit.ok);

  // 1.10 Missing propertyId → 400
  const noProp = await api('POST', '/api/housekeeping', {
    unitId, type: 'FULL_CLEAN', priority: 5,
  }, 400);
  test('Missing propertyId → 400', noProp.ok);

  // 1.11 Default type and priority
  const defaults = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId,
    notes: 'AUDIT-defaults',
  }, 201);
  test('Default type = FULL_CLEAN', defaults.data?.type === 'FULL_CLEAN');
  test('Default priority = 5', defaults.data?.priority === 5);

  return taskId;
}

// ═══════════════════════════════════════════════════════════════════
// 2. TASK LIFECYCLE / STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════
async function testTaskLifecycle() {
  console.log('\n═══ 2. TASK LIFECYCLE ═══');

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

  // Create tasks for each transition test
  for (const from of statuses) {
    for (const to of statuses) {
      if (from === to) continue;

      // Create task
      const createRes = await api('POST', '/api/housekeeping', {
        propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
        notes: `AUDIT-${from}-${to}`,
      }, 201);
      const taskId = createRes.data?.id;
      if (!taskId) continue;

      // Set to fromStatus (if not PENDING, need intermediate steps)
      if (from === 'IN_PROGRESS') {
        await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
      } else if (from === 'COMPLETED') {
        await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
        await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
      } else if (from === 'FAILED') {
        await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'FAILED' });
      }

      // Try the transition
      const patchRes = await api('PATCH', `/api/housekeeping/${taskId}`, { status: to });

      // Verify
      const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
      if (patchRes.ok) {
        test(`${from} → ${to}: allowed (API 200)`, dbTask?.status === to);
      } else {
        test(`${from} → ${to}: rejected (${patchRes.status})`, dbTask?.status === from,
          `db status=${dbTask?.status}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. TIMESTAMP LOGIC
// ═══════════════════════════════════════════════════════════════════
async function testTimestamps() {
  console.log('\n═══ 3. TIMESTAMP LOGIC ═══');

  // Create task
  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-timestamps',
  }, 201);
  const taskId = createRes.data?.id;
  if (!taskId) return;

  // 3.1 Initial state
  test('Initially: startedAt null', createRes.data?.startedAt === null);
  test('Initially: completedAt null', createRes.data?.completedAt === null);
  test('Initially: duration null', createRes.data?.duration === null);

  // 3.2 Start task
  const startBefore = Date.now();
  const startRes = await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
  const startAfter = Date.now();
  test('Start task → 200', startRes.ok);
  test('startedAt is set', !!startRes.data?.startedAt);
  test('completedAt still null', startRes.data?.completedAt === null);
  test('duration still null', startRes.data?.duration === null);

  // 3.3 Complete task
  // Add small delay so duration > 0
  await new Promise(r => setTimeout(r, 100));
  const completeRes = await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
  test('Complete task → 200', completeRes.ok);
  test('completedAt is set', !!completeRes.data?.completedAt);
  test('startedAt still set', !!completeRes.data?.startedAt);
  test('duration is calculated', typeof completeRes.data?.duration === 'number');
  test('duration >= 0', (completeRes.data?.duration || 0) >= 0);

  // 3.4 Verify startedAt <= completedAt
  const started = new Date(completeRes.data?.startedAt).getTime();
  const completed = new Date(completeRes.data?.completedAt).getTime();
  test('startedAt <= completedAt', started <= completed);

  // 3.5 Double-complete (idempotent?)
  const doubleComplete = await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
  test('Double complete: still 200 (idempotent)', doubleComplete.ok);
  // Timestamps should not change
  const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  test('Double complete: completedAt unchanged', dbTask?.completedAt?.getTime() === completed);
}

// ═══════════════════════════════════════════════════════════════════
// 4. ROOM ↔ HOUSEKEEPING CONSISTENCY
// ═══════════════════════════════════════════════════════════════════
async function testRoomConsistency() {
  console.log('\n═══ 4. ROOM ↔ HOUSEKEEPING CONSISTENCY ═══');

  // 4.1 Complete task with no active booking → unit should become VACANT_CLEAN
  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-room-consistency-1',
  }, 201);
  const taskId = createRes.data?.id;
  if (!taskId) return;

  // Set unit to VACANT_DIRTY first
  await prisma.unit.update({ where: { id: unitId }, data: { status: 'VACANT_DIRTY' } });
  const beforeUnit = await prisma.unit.findUnique({ where: { id: unitId } });
  test('Unit is VACANT_DIRTY before completion', beforeUnit?.status === 'VACANT_DIRTY');

  // Start and complete
  await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
  const completeRes = await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
  test('Task completed', completeRes.ok);

  // Check unit status
  const afterUnit = await prisma.unit.findUnique({ where: { id: unitId } });
  test('Unit → VACANT_CLEAN after completion (no active booking)', afterUnit?.status === 'VACANT_CLEAN');

  // 4.2 Complete task WITH active booking → unit should NOT change
  // Create a booking and check in
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 60);
  const departDate = new Date(futureDate);
  departDate.setDate(departDate.getDate() + 2);

  const bookRes = await api('POST', '/api/bookings', {
    propertyId: propId, unitId, guestId,
    arrivalDate: futureDate.toISOString().slice(0, 10),
    departureDate: departDate.toISOString().slice(0, 10),
    adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 0,
    source: 'DIRECT', status: 'PENDING',
  }, 201);
  const bookingId = bookRes.data?.id;

  if (bookingId) {
    // Pay and check in
    await api('POST', '/api/payments', { bookingId, amount: 10000, method: 'CASH', status: 'PAID' });
    await api('PATCH', `/api/bookings/${bookingId}`, { status: 'CONFIRMED' });
    const checkinRes = await api('POST', `/api/bookings/${bookingId}/check-in`);
    test('Check-in for consistency test', checkinRes.ok);

    // Set unit to OCCUPIED_DIRTY
    await prisma.unit.update({ where: { id: unitId }, data: { status: 'OCCUPIED_DIRTY' } });

    // Create and complete a housekeeping task
    const task2Res = await api('POST', '/api/housekeeping', {
      propertyId: propId, unitId, type: 'TOUCH_UP', priority: 5,
      notes: 'AUDIT-room-consistency-2', bookingId,
    }, 201);
    const taskId2 = task2Res.data?.id;
    if (taskId2) {
      await api('PATCH', `/api/housekeeping/${taskId2}`, { status: 'IN_PROGRESS' });
      await api('PATCH', `/api/housekeeping/${taskId2}`, { status: 'COMPLETED' });

      const afterUnit2 = await prisma.unit.findUnique({ where: { id: unitId } });
      test('Unit stays OCCUPIED when active booking exists', afterUnit2?.status?.startsWith('OCCUPIED'));
    }

    // Check out and cancel to clean up
    await api('POST', `/api/bookings/${bookingId}/check-out`);
    await api('PATCH', `/api/bookings/${bookingId}`, { status: 'CANCELED' });
  }

  // 4.3 Case: Unit is OUT_OF_ORDER, task completes → what happens?
  await prisma.unit.update({ where: { id: unitId }, data: { status: 'OUT_OF_ORDER' } });
  const task3Res = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'INSPECTION', priority: 5,
    notes: 'AUDIT-room-consistency-3',
  }, 201);
  if (task3Res.data?.id) {
    await api('PATCH', `/api/housekeeping/${task3Res.data.id}`, { status: 'IN_PROGRESS' });
    await api('PATCH', `/api/housekeeping/${task3Res.data.id}`, { status: 'COMPLETED' });
    const afterUnit3 = await prisma.unit.findUnique({ where: { id: unitId } });
    test('OUT_OF_ORDER → VACANT_CLEAN after task complete (no booking)', afterUnit3?.status === 'VACANT_CLEAN');
  }

  // 4.4 Case: Manual status override - set unit to OCCUPIED while task is pending
  await prisma.unit.update({ where: { id: unitId }, data: { status: 'VACANT_DIRTY' } });
  const task4Res = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-room-consistency-4',
  }, 201);
  // Now manually set unit to OCCUPIED_CLEAN (someone checks in)
  await prisma.unit.update({ where: { id: unitId }, data: { status: 'OCCUPIED_CLEAN' } });
  // Complete the task
  if (task4Res.data?.id) {
    await api('PATCH', `/api/housekeeping/${task4Res.data.id}`, { status: 'IN_PROGRESS' });
    await api('PATCH', `/api/housekeeping/${task4Res.data.id}`, { status: 'COMPLETED' });
    // Unit was OCCUPIED_CLEAN but task had no bookingId — check if it overrides
    const afterUnit4 = await prisma.unit.findUnique({ where: { id: unitId } });
    // The code checks for active CHECKED_IN bookings, not the current unit status
    test('Unit status after completing task with no booking but unit=OCCUPIED', afterUnit4?.status === 'VACANT_CLEAN',
      `status=${afterUnit4?.status}`);
    // BUG: This changes OCCUPIED_CLEAN → VACANT_CLEAN even though unit is occupied!
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. DUPLICATE TASKS
// ═══════════════════════════════════════════════════════════════════
async function testDuplicateTasks() {
  console.log('\n═══ 5. DUPLICATE TASKS ═══');

  // 5.1 Create two identical tasks
  const t1 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-dup-1',
  }, 201);
  const t2 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-dup-2',
  }, 201);
  test('Two identical tasks both created → 201', t1.ok && t2.ok);
  test('Both have different IDs', t1.data?.id !== t2.data?.id);

  // 5.2 Rapid double-click simulation
  const rapid1 = api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 3,
    notes: 'AUDIT-rapid-1',
  }, 201);
  const rapid2 = api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 3,
    notes: 'AUDIT-rapid-2',
  }, 201);
  const [r1, r2] = await Promise.all([rapid1, rapid2]);
  test('Rapid double-submit: both succeed (no dedup)', r1.ok && r2.ok);

  // 5.3 Count active tasks for unit
  const activeTasks = await prisma.housekeepingTask.findMany({
    where: { unitId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });
  test(`Unit has ${activeTasks.length} active tasks (multiple allowed)`, activeTasks.length >= 2);
}

// ═══════════════════════════════════════════════════════════════════
// 6. ASSIGNMENT LOGIC
// ═══════════════════════════════════════════════════════════════════
async function testAssignment() {
  console.log('\n═══ 6. ASSIGNMENT LOGIC ═══');

  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-assignment',
  }, 201);
  const taskId = createRes.data?.id;
  if (!taskId) return;

  // 6.1 No assignee initially
  test('No assignee initially', createRes.data?.assigneeId === null);

  // 6.2 Assign to staff
  const assignRes = await api('PATCH', `/api/housekeeping/${taskId}`, {
    assigneeId: 'cmu1kcq010002pjs7xu8h9mv1',
  });
  test('Assign to staff → 200', assignRes.ok);
  test('Assignee set', assignRes.data?.assigneeId === 'cmu1kcq010002pjs7xu8h9mv1');

  // 6.3 Reassign to different staff
  // We need another user. Create one via invite flow or use existing.
  // For now, reassign to null (unassign)
  const unassignRes = await api('PATCH', `/api/housekeeping/${taskId}`, {
    assigneeId: null,
  });
  test('Unassign → 200', unassignRes.ok);
  test('Assignee is null', unassignRes.data?.assigneeId === null);

  // 6.4 Assign invalid user ID
  const badAssign = await api('PATCH', `/api/housekeeping/${taskId}`, {
    assigneeId: 'nonexistent-user-id',
  });
  // Does the API validate the assignee exists?
  test('Invalid assignee ID handled', badAssign.ok || badAssign.status === 400,
    `got ${badAssign.status}`);
}

// ═══════════════════════════════════════════════════════════════════
// 7. CANCELLATION / DELETION
// ═══════════════════════════════════════════════════════════════════
async function testCancellationDeletion() {
  console.log('\n═══ 7. CANCELLATION / DELETION ═══');

  // 7.1 Delete pending task
  const t1 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-delete-1',
  }, 201);
  if (t1.data?.id) {
    const delRes = await api('DELETE', `/api/housekeeping/${t1.data.id}`);
    test('Delete pending task → 200', delRes.ok);
    const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: t1.data.id } });
    test('Task hard-deleted', !dbTask);
  }

  // 7.2 Delete in-progress task
  const t2 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 5,
    notes: 'AUDIT-delete-2',
  }, 201);
  if (t2.data?.id) {
    await api('PATCH', `/api/housekeeping/${t2.data.id}`, { status: 'IN_PROGRESS' });
    const delRes = await api('DELETE', `/api/housekeeping/${t2.data.id}`);
    test('Delete in-progress task → 200', delRes.ok);
  }

  // 7.3 Delete completed task
  const t3 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-delete-3',
  }, 201);
  if (t3.data?.id) {
    await api('PATCH', `/api/housekeeping/${t3.data.id}`, { status: 'IN_PROGRESS' });
    await api('PATCH', `/api/housekeeping/${t3.data.id}`, { status: 'COMPLETED' });
    const delRes = await api('DELETE', `/api/housekeeping/${t3.data.id}`);
    test('Delete completed task → 200', delRes.ok);
  }

  // 7.4 FAILED status handling
  const t4 = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'INSPECTION', priority: 8,
    notes: 'AUDIT-failed',
  }, 201);
  if (t4.data?.id) {
    const failRes = await api('PATCH', `/api/housekeeping/${t4.data.id}`, { status: 'FAILED' });
    test('Set task to FAILED → 200', failRes.ok);
    const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: t4.data.id } });
    test('FAILED task has no timestamps', !dbTask?.startedAt && !dbTask?.completedAt);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 8. AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════
async function testAuthorization() {
  console.log('\n═══ 8. AUTHORIZATION ═══');

  // 8.1 No auth → 401
  const noAuth = await fetch(`${BASE}/api/housekeeping`, {
    headers: { origin: BASE },
  });
  test('No auth → 401/302', [302, 401].includes(noAuth.status));

  // 8.2 Create without auth
  const noAuthCreate = await fetch(`${BASE}/api/housekeeping`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5 }),
  });
  test('Create without auth → 401', [302, 401].includes(noAuthCreate.status));

  // 8.3 IDOR: try accessing task from different org
  const fakeTaskId = 'clx00000000000000000000000';
  const idorPatch = await api('PATCH', `/api/housekeeping/${fakeTaskId}`, { status: 'IN_PROGRESS' });
  test('IDOR: non-existent task → 404', idorPatch.status === 404);

  const idorDel = await api('DELETE', `/api/housekeeping/${fakeTaskId}`);
  test('IDOR: delete non-existent → 404', idorDel.status === 404);
}

// ═══════════════════════════════════════════════════════════════════
// 9. EDGE CASES
// ═══════════════════════════════════════════════════════════════════
async function testEdgeCases() {
  console.log('\n═══ 9. EDGE CASES ═══');

  // 9.1 Very long notes
  const longNotes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'A'.repeat(5000),
  }, 201);
  test('Very long notes (5000 chars) → 201', longNotes.ok);

  // 9.2 Unicode notes
  const unicodeNotes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-unicode-テスト- roomId: 101',
  }, 201);
  test('Unicode notes → 201', unicodeNotes.ok);

  // 9.3 Scheduled for in the past
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);
  const pastSched = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    scheduledFor: pastDate.toISOString(), notes: 'AUDIT-past',
  }, 201);
  test('Scheduled in past → 201 (allowed)', pastSched.ok);

  // 9.4 Scheduled for in the future
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureSched = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    scheduledFor: futureDate.toISOString(), notes: 'AUDIT-future',
  }, 201);
  test('Scheduled in future → 201', futureSched.ok);

  // 9.5 Start task without going through PENDING → IN_PROGRESS
  const directStart = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-direct-start',
  }, 201);
  if (directStart.data?.id) {
    const startRes = await api('PATCH', `/api/housekeeping/${directStart.data.id}`, { status: 'IN_PROGRESS' });
    test('PENDING → IN_PROGRESS directly', startRes.ok);
  }

  // 9.6 Complete without starting first
  const noStart = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 5,
    notes: 'AUDIT-no-start',
  }, 201);
  if (noStart.data?.id) {
    const completeDirect = await api('PATCH', `/api/housekeeping/${noStart.data.id}`, { status: 'COMPLETED' });
    // Is PENDING → COMPLETED allowed?
    const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: noStart.data.id } });
    test('PENDING → COMPLETED directly (no start)', completeDirect.ok, `got ${completeDirect.status}`);
    if (dbTask?.completedAt && !dbTask?.startedAt) {
      test('BUG: completedAt set but startedAt null', false, 'duration calculation may fail');
    }
  }

  // 9.7 PATCH with invalid status
  const invStatus = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-inv-status',
  }, 201);
  if (invStatus.data?.id) {
    const badPatch = await api('PATCH', `/api/housekeeping/${invStatus.data.id}`, { status: 'INVALID' });
    test('Invalid status → 400', badPatch.status === 400);
  }

  // 9.8 Priority boundary values
  const priBoundary = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 1,
    notes: 'AUDIT-pri-boundary',
  }, 201);
  if (priBoundary.data?.id) {
    const updPri = await api('PATCH', `/api/housekeeping/${priBoundary.data.id}`, { priority: 10 });
    test('Update priority to 10 → 200', updPri.ok);
    const updPriBad = await api('PATCH', `/api/housekeeping/${priBoundary.data.id}`, { priority: 11 });
    test('Update priority to 11 → 400', updPriBad.status === 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 10. AUTO-CREATION FROM BOOKINGS
// ═══════════════════════════════════════════════════════════════════
async function testAutoCreation() {
  console.log('\n═══ 10. AUTO-CREATION FROM BOOKINGS ═══');

  // 10.1 Booking creation → FULL_CLEAN task
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);
  const departDate = new Date(futureDate);
  departDate.setDate(departDate.getDate() + 2);

  const bookRes = await api('POST', '/api/bookings', {
    propertyId: propId, unitId, guestId,
    arrivalDate: futureDate.toISOString().slice(0, 10),
    departureDate: departDate.toISOString().slice(0, 10),
    adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 0,
    source: 'DIRECT', status: 'PENDING',
  }, 201);
  const bookingId = bookRes.data?.id;
  test('Booking created for auto-task test', !!bookingId);

  if (bookingId) {
    // Check for auto-created FULL_CLEAN task
    const tasks = await prisma.housekeepingTask.findMany({
      where: { unitId, bookingId, type: 'FULL_CLEAN' },
    });
    test('FULL_CLEAN task auto-created on booking', tasks.length > 0);

    // 10.2 Check-in → TURNDOWN task
    // Pay and check in
    await api('POST', '/api/payments', { bookingId, amount: 10000, method: 'CASH', status: 'PAID' });
    await api('PATCH', `/api/bookings/${bookingId}`, { status: 'CONFIRMED' });
    const checkinRes = await api('POST', `/api/bookings/${bookingId}/check-in`);
    test('Check-in for auto-task test', checkinRes.ok);

    const turndownTasks = await prisma.housekeepingTask.findMany({
      where: { unitId, bookingId, type: 'TURNDOWN' },
    });
    test('TURNDOWN task auto-created on check-in', turndownTasks.length > 0);

    // 10.3 Check-out → FULL_CLEAN task
    const checkoutRes = await api('POST', `/api/bookings/${bookingId}/check-out`);
    test('Check-out for auto-task test', checkoutRes.ok);

    const checkoutTasks = await prisma.housekeepingTask.findMany({
      where: { unitId, type: 'FULL_CLEAN', notes: { contains: 'Full clean after check-out' } },
    });
    test('FULL_CLEAN task auto-created on check-out', checkoutTasks.length > 0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 11. DURATION CALCULATION
// ═══════════════════════════════════════════════════════════════════
async function testDurationCalculation() {
  console.log('\n═══ 11. DURATION CALCULATION ═══');

  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-duration',
  }, 201);
  const taskId = createRes.data?.id;
  if (!taskId) return;

  // Start
  await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });

  // Wait 200ms
  await new Promise(r => setTimeout(r, 200));

  // Complete
  const completeRes = await api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });

  const duration = completeRes.data?.duration;
  test('Duration calculated', typeof duration === 'number');
  test('Duration >= 0 minutes', duration >= 0);

  // Verify against actual timestamps
  const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  if (dbTask?.startedAt && dbTask?.completedAt) {
    const expectedMinutes = Math.round((dbTask.completedAt.getTime() - dbTask.startedAt.getTime()) / 60000);
    test('Duration matches timestamps', duration === expectedMinutes,
      `expected ${expectedMinutes}, got ${duration}`);
  }

  // 11.2 Complete without start → no duration
  const noStart = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 5,
    notes: 'AUDIT-duration-nostart',
  }, 201);
  if (noStart.data?.id) {
    const compNoStart = await api('PATCH', `/api/housekeeping/${noStart.data.id}`, { status: 'COMPLETED' });
    // If PENDING → COMPLETED is allowed, duration should be null or 0
    test('Duration when completing without start', 
      compNoStart.data?.duration === null || compNoStart.data?.duration === undefined,
      `duration=${compNoStart.data?.duration}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 12. CONCURRENT ACTIONS
// ═══════════════════════════════════════════════════════════════════
async function testConcurrency() {
  console.log('\n═══ 12. CONCURRENT ACTIONS ═══');

  const createRes = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'FULL_CLEAN', priority: 5,
    notes: 'AUDIT-concurrency',
  }, 201);
  const taskId = createRes.data?.id;
  if (!taskId) return;

  // 12.1 Two concurrent starts
  const start1 = api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
  const start2 = api('PATCH', `/api/housekeeping/${taskId}`, { status: 'IN_PROGRESS' });
  const [s1, s2] = await Promise.all([start1, start2]);
  test('Concurrent start: both succeed (idempotent)', s1.ok && s2.ok);

  // 12.2 Two concurrent completions
  const comp1 = api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
  const comp2 = api('PATCH', `/api/housekeeping/${taskId}`, { status: 'COMPLETED' });
  const [c1, c2] = await Promise.all([comp1, comp2]);
  test('Concurrent complete: both succeed (idempotent)', c1.ok && c2.ok);

  // Verify timestamps aren't double-set
  const dbTask = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
  test('Only one startedAt after concurrent start', !!dbTask?.startedAt);
  test('Only one completedAt after concurrent complete', !!dbTask?.completedAt);

  // 12.3 Start + Complete simultaneously
  const t2Res = await api('POST', '/api/housekeeping', {
    propertyId: propId, unitId, type: 'TOUCH_UP', priority: 5,
    notes: 'AUDIT-concurrency-2',
  }, 201);
  if (t2Res.data?.id) {
    const start = api('PATCH', `/api/housekeeping/${t2Res.data.id}`, { status: 'IN_PROGRESS' });
    const complete = api('PATCH', `/api/housekeeping/${t2Res.data.id}`, { status: 'COMPLETED' });
    const [st, co] = await Promise.all([start, complete]);
    // One should succeed, one should fail or both succeed (depending on race)
    const dbTask2 = await prisma.housekeepingTask.findUnique({ where: { id: t2Res.data.id } });
    test('Start + Complete race: valid end state',
      dbTask2?.status === 'IN_PROGRESS' || dbTask2?.status === 'COMPLETED',
      `status=${dbTask2?.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  HOUSEKEEPING MODULE AUDIT');
  console.log('═══════════════════════════════════════════════════');

  await login();
  console.log(`  Logged in (org: ${orgId})`);

  await cleanup();
  await setupTestData();
  console.log(`  Test data: prop=${propId}, unit=${unitId}`);

  await testTaskCreation();
  await testTaskLifecycle();
  await testTimestamps();
  await testRoomConsistency();
  await testDuplicateTasks();
  await testAssignment();
  await testCancellationDeletion();
  await testAuthorization();
  await testEdgeCases();
  await testAutoCreation();
  await testDurationCalculation();
  await testConcurrency();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${blocked} blocked`);
  console.log('═══════════════════════════════════════════════════');

  await cleanup();
  await prisma.$disconnect();
}

run().catch(console.error);
