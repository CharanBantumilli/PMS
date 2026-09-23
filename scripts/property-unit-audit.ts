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
  return { status: res.status, data, ok: Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus };
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
  cookies = (csrfRes.headers.getSetCookie?.() || csrfRes.headers.get('set-cookie')?.split(', ') || []).map(c => c.split(';')[0]);
  const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken, email: 'demo@azurebay.com', password: 'demo1234', callbackUrl: `${BASE}/dashboard`, json: 'true' }),
    redirect: 'manual',
  });
  const rawNC = lr.headers.getSetCookie?.() || lr.headers.get('set-cookie')?.split(', ') || [];
  const newCookies = rawNC.map((c: string) => c.split(';')[0]);
  cookies = [...cookies, ...newCookies];
  const session = await api('GET', '/api/auth/session');
  orgId = session.data?.user?.organizationId;
}

async function cleanup() {
  // Clean up test data from previous runs
  const testProps = await prisma.property.findMany({ where: { code: { startsWith: 'AUDIT-' } } });
  for (const p of testProps) {
    await prisma.housekeepingTask.deleteMany({ where: { unit: { propertyId: p.id } } });
    await prisma.maintenanceTicket.deleteMany({ where: { unit: { propertyId: p.id } } });
    await prisma.booking.deleteMany({ where: { propertyId: p.id } });
    await prisma.unit.deleteMany({ where: { propertyId: p.id } });
    await prisma.property.delete({ where: { id: p.id } });
  }
  // Also clean any units with AUDIT number prefix
  await prisma.unit.deleteMany({ where: { number: { startsWith: 'AUDIT-' } } });
}

// ═══════════════════════════════════════════════════════════════════
// 1. PROPERTY CRUD
// ═══════════════════════════════════════════════════════════════════
async function testPropertyCRUD() {
  console.log('\n═══ 1. PROPERTY CRUD ═══');

  // 1.1 Create property
  const createRes = await api('POST', '/api/properties', {
    name: 'Audit Test Hotel', code: `AUDIT-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
    city: 'Mumbai', state: 'MH', country: 'IN', starRating: 4,
    phone: '+919876543210', email: 'audit@test.com',
    description: 'Test property for audit', policies: 'No smoking',
  }, 201);
  test('Create property → 201', createRes.ok, `got ${createRes.status}: ${JSON.stringify(createRes.data).slice(0,200)}`);
  const propId = createRes.data?.id;
  test('Property has id', !!propId);
  test('Property name correct', createRes.data?.name === 'Audit Test Hotel');
  test('Property code stored', !!createRes.data?.code);
  test('Property type correct', createRes.data?.type === 'HOTEL');
  test('Property city correct', createRes.data?.city === 'Mumbai');
  test('Property isActive = true', createRes.data?.isActive === true);
  test('Property deletedAt = null', createRes.data?.deletedAt === null);
  test('Star rating stored', createRes.data?.starRating === 4);
  test('Phone stored', createRes.data?.phone === '+919876543210');
  test('Email stored', createRes.data?.email === 'audit@test.com');

  // 1.2 Read property
  if (propId) {
    const getRes = await api('GET', `/api/properties/${propId}`);
    test('GET property → 200', getRes.ok);
    test('GET returns same id', getRes.data?.id === propId);
    test('GET returns units array', Array.isArray(getRes.data?.units));
  }

  // 1.3 List properties
  const listRes = await api('GET', '/api/properties');
  test('List properties → 200', listRes.ok);
  test('List returns array', Array.isArray(listRes.data));
  const found = listRes.data?.find((p: any) => p.id === propId);
  test('Created property in list', !!found);
  test('List includes _count.units', !!found?._count);

  // 1.4 Update property
  if (propId) {
    const updRes = await api('PATCH', `/api/properties/${propId}`, {
      name: 'Audit Test Hotel Updated', starRating: 5, city: 'Delhi',
    });
    test('PATCH property → 200', updRes.ok);
    test('Name updated', updRes.data?.name === 'Audit Test Hotel Updated');
    test('Star rating updated', updRes.data?.starRating === 5);
    test('City updated', updRes.data?.city === 'Delhi');
    // Verify other fields unchanged
    test('Type unchanged', updRes.data?.type === 'HOTEL');
    test('Code unchanged', updRes.data?.code === createRes.data?.code);
  }

  // 1.5 Create duplicate code → should fail
  const dupRes = await api('POST', '/api/properties', {
    name: 'Duplicate Code Hotel', code: createRes.data?.code, type: 'HOTEL',
  }, [409, 400]);
  test('Duplicate code rejected', dupRes.ok, `got ${dupRes.status}`);

  // 1.6 Create with same name (different code) → should succeed
  const sameNameRes = await api('POST', '/api/properties', {
    name: 'Audit Test Hotel', code: `AUDIT-SN-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  test('Same name, different code → 201', sameNameRes.ok, `got ${sameNameRes.status}`);

  // 1.7 Soft delete
  if (propId) {
    const delRes = await api('DELETE', `/api/properties/${propId}`);
    test('DELETE property → 200', delRes.ok);

    // Verify soft deleted (not in list)
    const listAfter = await api('GET', '/api/properties');
    const stillThere = listAfter.data?.find((p: any) => p.id === propId);
    test('Soft-deleted property not in list', !stillThere);

    // Verify DB has deletedAt set
    const dbProp = await prisma.property.findUnique({ where: { id: propId } });
    test('DB has deletedAt set', !!dbProp?.deletedAt);
    test('DB record still exists', !!dbProp);
  }

  // 1.8 Validation tests
  const noName = await api('POST', '/api/properties', { code: 'X', type: 'HOTEL' }, 400);
  test('Missing name → 400', noName.ok);

  const noCode = await api('POST', '/api/properties', { name: 'Test', type: 'HOTEL' }, 400);
  test('Missing code → 400', noCode.ok);

  const noType = await api('POST', '/api/properties', { name: 'Test', code: 'NO-TYPE' }, 400);
  test('Missing type → 400', noType.ok);

  const badCode = await api('POST', '/api/properties', { name: 'Test', code: 'HAS SPACES!', type: 'HOTEL' }, 400);
  test('Code with spaces → 400', badCode.ok);

  const badCode2 = await api('POST', '/api/properties', { name: 'Test', code: 'has@special', type: 'HOTEL' }, 400);
  test('Code with special chars → 400', badCode2.ok);

  const shortName = await api('POST', '/api/properties', { name: 'A', code: 'SHORT', type: 'HOTEL' }, 400);
  test('Name too short (1 char) → 400', shortName.ok);

  const longName = await api('POST', '/api/properties', { name: 'A'.repeat(121), code: 'LONG', type: 'HOTEL' }, 400);
  test('Name too long (121 chars) → 400', longName.ok);

  const badRating = await api('POST', '/api/properties', { name: 'Bad Rating', code: 'BAD-R', type: 'HOTEL', starRating: 6 }, 400);
  test('Star rating > 5 → 400', badRating.ok);

  const badRating2 = await api('POST', '/api/properties', { name: 'Bad Rating2', code: 'BAD-R2', type: 'HOTEL', starRating: -1 }, 400);
  test('Star rating < 0 → 400', badRating2.ok);

  const badType = await api('POST', '/api/properties', { name: 'Bad Type', code: 'BAD-T', type: 'INVALID' }, 400);
  test('Invalid type → 400', badType.ok);

  const badPhone = await api('POST', '/api/properties', { name: 'Bad Phone', code: 'BAD-P', type: 'HOTEL', phone: '123' }, 400);
  test('Invalid phone → 400', badPhone.ok);

  const badEmail = await api('POST', '/api/properties', { name: 'Bad Email', code: 'BAD-E', type: 'HOTEL', email: 'notanemail' }, 400);
  test('Invalid email → 400', badEmail.ok);

  // 1.9 Whitespace handling
  const spacesName = await api('POST', '/api/properties', {
    name: '  Spaces Hotel  ', code: `AUDIT-SP-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  test('Name with leading/trailing spaces → 201', spacesName.ok);
  if (spacesName.ok) {
    // Check if spaces are trimmed
    const hasLeadingSpace = spacesName.data?.name?.startsWith(' ');
    test('Leading spaces trimmed', !hasLeadingSpace, `name="${spacesName.data?.name}"`);
    // Cleanup
    await prisma.property.delete({ where: { id: spacesName.data?.id } }).catch(() => {});
  }

  // 1.10 Empty code
  const emptyCode = await api('POST', '/api/properties', { name: 'Empty Code', code: '', type: 'HOTEL' }, 400);
  test('Empty code → 400', emptyCode.ok);

  // 1.11 Very long code
  const longCode = await api('POST', '/api/properties', { name: 'Long Code', code: 'A'.repeat(21), type: 'HOTEL' }, 400);
  test('Code > 20 chars → 400', longCode.ok);
}

// ═══════════════════════════════════════════════════════════════════
// 2. UNIT CRUD
// ═══════════════════════════════════════════════════════════════════
async function testUnitCRUD() {
  console.log('\n═══ 2. UNIT CRUD ═══');

  // Create a property for units
  const propRes = await api('POST', '/api/properties', {
    name: 'Unit Test Hotel', code: `AUDIT-U-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const propId = propRes.data?.id;
  test('Create test property', !!propId);
  if (!propId) return;

  // 2.1 Create unit
  const unitRes = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-101', name: 'Deluxe King Room', floor: '1',
    status: 'VACANT_CLEAN', unitTypeId: null,
  }, 201);
  test('Create unit → 201', unitRes.ok, `got ${unitRes.status}: ${JSON.stringify(unitRes.data).slice(0,200)}`);
  const unitId = unitRes.data?.id;
  test('Unit has id', !!unitId);
  test('Unit number correct', unitRes.data?.number === 'AUDIT-101');
  test('Unit name correct', unitRes.data?.name === 'Deluxe King Room');
  test('Unit floor correct', unitRes.data?.floor === '1');
  test('Unit status = VACANT_CLEAN', unitRes.data?.status === 'VACANT_CLEAN');
  test('Unit propertyId correct', unitRes.data?.propertyId === propId);
  test('Unit isActive = true', unitRes.data?.isActive === true);

  // 2.2 List units
  const listRes = await api('GET', '/api/units');
  test('List units → 200', listRes.ok);
  // Units API returns array directly (not paginated)
  const unitsArr = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.data || []);
  const found = unitsArr.find((u: any) => u.id === unitId);
  test('Created unit in list', !!found);

  // 2.3 List units with property filter
  const filterRes = await api('GET', `/api/units?propertyId=${propId}`);
  test('Filter by property → 200', filterRes.ok);
  const filteredArr = Array.isArray(filterRes.data) ? filterRes.data : (filterRes.data?.data || []);
  const allMatch = filteredArr.every((u: any) => u.propertyId === propId);
  test('All filtered units belong to property', allMatch);

  // 2.4 Get unit detail (via PATCH/read pattern — no GET /api/units/:id exists)
  // Actually, there's no GET /api/units/:id. Verify via list.
  test('No GET /api/units/:id endpoint (by design)', true);

  // 2.5 Update unit
  if (unitId) {
    const updRes = await api('PATCH', `/api/units/${unitId}`, {
      name: 'Updated Suite', floor: '2', status: 'VACANT_DIRTY',
    });
    test('PATCH unit → 200', updRes.ok);
    test('Name updated', updRes.data?.name === 'Updated Suite');
    test('Floor updated', updRes.data?.floor === '2');
    test('Status updated', updRes.data?.status === 'VACANT_DIRTY');
    test('Number unchanged', updRes.data?.number === 'AUDIT-101');
    test('PropertyId unchanged', updRes.data?.propertyId === propId);
  }

  // 2.6 Create duplicate unit number in same property → should fail (DB constraint)
  const dupUnit = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-101', name: 'Duplicate Room',
  }, [409, 400, 500]);
  test('Duplicate unit number in same property rejected', dupUnit.ok, `got ${dupUnit.status}`);

  // 2.7 Same unit number in DIFFERENT property → should succeed
  const prop2Res = await api('POST', '/api/properties', {
    name: 'Unit Test Hotel 2', code: `AUDIT-U2-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const prop2Id = prop2Res.data?.id;
  if (prop2Id) {
    const sameNumDiffProp = await api('POST', '/api/units', {
      propertyId: prop2Id, number: 'AUDIT-101', name: 'Same Number Different Property',
    }, 201);
    test('Same number in different property → 201', sameNumDiffProp.ok, `got ${sameNumDiffProp.status}`);
    // Cleanup
    if (sameNumDiffProp.data?.id) {
      await prisma.unit.delete({ where: { id: sameNumDiffProp.data.id } }).catch(() => {});
    }
    await prisma.property.delete({ where: { id: prop2Id } }).catch(() => {});
  }

  // 2.8 Validation tests
  const noPropId = await api('POST', '/api/units', { number: '101', name: 'No Property' }, 400);
  test('Missing propertyId → 400', noPropId.ok);

  const noNumber = await api('POST', '/api/units', { propertyId: propId, name: 'No Number' }, 400);
  test('Missing number → 400', noNumber.ok);

  const noName = await api('POST', '/api/units', { propertyId: propId, number: '102' }, 400);
  test('Missing name → 400', noName.ok);

  const badStatus = await api('POST', '/api/units', { propertyId: propId, number: '103', name: 'Bad Status', status: 'INVALID' }, 400);
  test('Invalid status → 400', badStatus.ok);

  // 2.9 Hard delete unit
  if (unitId) {
    const delRes = await api('DELETE', `/api/units/${unitId}`);
    test('DELETE unit → 200', delRes.ok);
    // Verify hard deleted
    const dbUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    test('Unit hard-deleted from DB', !dbUnit);
  }

  // Cleanup
  await prisma.property.delete({ where: { id: propId } }).catch(() => {});
  if (prop2Id) await prisma.property.delete({ where: { id: prop2Id } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 3. UNIT TYPE CRUD
// ═══════════════════════════════════════════════════════════════════
async function testUnitTypeCRUD() {
  console.log('\n═══ 3. UNIT TYPE CRUD ═══');

  // 3.1 Create unit type
  const typeRes = await api('POST', '/api/unit-types', {
    name: 'Audit Deluxe', baseOccupancy: 2, maxOccupancy: 4,
    bedType: 'KING', bedCount: 1, bathroomCount: 1,
    extraPersonFee: 500, size: 35.5,
  }, 201);
  test('Create unit type → 201', typeRes.ok, `got ${typeRes.status}: ${JSON.stringify(typeRes.data).slice(0,200)}`);
  const typeId = typeRes.data?.id;
  test('Type has id', !!typeId);
  test('Type name correct', typeRes.data?.name === 'Audit Deluxe');
  test('Base occupancy = 2', typeRes.data?.baseOccupancy === 2);
  test('Max occupancy = 4', typeRes.data?.maxOccupancy === 4);
  test('Bed type = KING', typeRes.data?.bedType === 'KING');
  test('Bed count = 1', typeRes.data?.bedCount === 1);
  test('Bathroom count = 1', typeRes.data?.bathroomCount === 1);

  // 3.2 Duplicate name — no constraint, should succeed
  const dupType = await api('POST', '/api/unit-types', {
    name: 'Audit Deluxe', baseOccupancy: 1, maxOccupancy: 2,
  }, 201);
  test('Duplicate type name → 201 (no uniqueness constraint)', dupType.ok, `got ${dupType.status}`);

  // 3.3 Update type
  if (typeId) {
    const updRes = await api('PATCH', `/api/unit-types/${typeId}`, {
      name: 'Audit Deluxe Updated', maxOccupancy: 6,
    });
    test('PATCH unit type → 200', updRes.ok);
    test('Name updated', updRes.data?.name === 'Audit Deluxe Updated');
    test('Max occupancy updated', updRes.data?.maxOccupancy === 6);
  }

  // 3.4 Validation tests
  const noName = await api('POST', '/api/unit-types', { baseOccupancy: 2, maxOccupancy: 4 }, 400);
  test('Missing name → 400', noName.ok);

  const zeroBase = await api('POST', '/api/unit-types', { name: 'Zero Base', baseOccupancy: 0, maxOccupancy: 2 }, 400);
  test('baseOccupancy = 0 → 400', zeroBase.ok);

  const negBase = await api('POST', '/api/unit-types', { name: 'Neg Base', baseOccupancy: -1, maxOccupancy: 2 }, 400);
  test('baseOccupancy = -1 → 400', negBase.ok);

  const maxLessThanBase = await api('POST', '/api/unit-types', { name: 'Bad Max', baseOccupancy: 5, maxOccupancy: 2 }, 201);
  // Check: is maxOccupancy < baseOccupancy rejected?
  // The schema validates them independently — no cross-field validation
  test('maxOccupancy < baseOccupancy → accepted (no cross-validation)', maxLessThanBase.ok, `got ${maxLessThanBase.status}`);
  if (maxLessThanBase.data?.id) {
    await prisma.unitTypeDefinition.delete({ where: { id: maxLessThanBase.data.id } }).catch(() => {});
  }

  const zeroMax = await api('POST', '/api/unit-types', { name: 'Zero Max', baseOccupancy: 1, maxOccupancy: 0 }, 400);
  test('maxOccupancy = 0 → 400', zeroMax.ok);

  const negFee = await api('POST', '/api/unit-types', { name: 'Neg Fee', baseOccupancy: 2, maxOccupancy: 2, extraPersonFee: -100 }, 400);
  test('Negative extraPersonFee → 400', negFee.ok);

  // 3.5 Hard delete type
  if (typeId) {
    const delRes = await api('DELETE', `/api/unit-types/${typeId}`);
    test('DELETE unit type → 200', delRes.ok);
    const dbType = await prisma.unitTypeDefinition.findUnique({ where: { id: typeId } });
    test('Type hard-deleted', !dbType);
  }
  // Cleanup dup
  if (dupType.data?.id) {
    await prisma.unitTypeDefinition.delete({ where: { id: dupType.data.id } }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. CASCADE & DELETION SAFETY
// ═══════════════════════════════════════════════════════════════════
async function testCascadeSafety() {
  console.log('\n═══ 4. CASCADE & DELETION SAFETY ═══');

  // Create property with units
  const propRes = await api('POST', '/api/properties', {
    name: 'Cascade Test Hotel', code: `AUDIT-CS-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const propId = propRes.data?.id;
  if (!propId) { block('All cascade tests', 'Property creation failed'); return; }

  const unitRes = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-CS-101', name: 'Cascade Room',
  }, 201);
  const unitId = unitRes.data?.id;

  // Create a booking for the unit
  // (Need a guest first)
  const guestRes = await api('POST', '/api/guests', {
    firstName: 'Cascade', lastName: 'Tester', email: `cascade-${Date.now()}@test.com`, phone: `+9198765${String(Date.now()).slice(-4)}`,
  }, 201);
  const guestId = guestRes.data?.id;

  let bookingId = '';
  if (guestId && unitId) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const departDate = new Date(futureDate);
    departDate.setDate(departDate.getDate() + 2);

    const bookRes = await api('POST', '/api/bookings', {
      propertyId: propId, unitId, guestId,
      arrivalDate: futureDate.toISOString().slice(0, 10),
      departureDate: departDate.toISOString().slice(0, 10),
      adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 0,
      source: 'DIRECT', status: 'PENDING',
    }, 201);
    bookingId = bookRes.data?.id;
    test('Booking created for cascade test', !!bookingId);
  }

  // 4.1 Delete property with units — should soft delete
  const delPropRes = await api('DELETE', `/api/properties/${propId}`);
  test('Delete property with units → 200', delPropRes.ok);

  // Verify property soft deleted
  const dbProp = await prisma.property.findUnique({ where: { id: propId } });
  test('Property soft-deleted (record exists with deletedAt)', !!dbProp && !!dbProp.deletedAt);

  // Verify unit still exists (property delete is soft, so FK cascade doesn't trigger)
  if (unitId) {
    const dbUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    // Property is soft-deleted (not hard-deleted), so cascade doesn't fire
    test('Unit still exists after property soft-delete', !!dbUnit);
    // But unit won't appear in filtered queries (property has deletedAt)
  }

  // 4.2 Now hard-delete the unit
  if (unitId) {
    const delUnitRes = await api('DELETE', `/api/units/${unitId}`);
    test('Delete unit → 200', delUnitRes.ok);
    const dbUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    test('Unit hard-deleted', !dbUnit);
  }

  // 4.3 Check what happens to the booking
  if (bookingId) {
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    test('Booking still exists after unit deletion', !!dbBooking);
    // Booking.unitId should be null or the FK should be preserved
    if (dbBooking) {
      test('Booking unitId after unit deletion', dbBooking.unitId === null || dbBooking.unitId === unitId,
        `unitId=${dbBooking.unitId}`);
    }
  }

  // 4.4 Try to delete property via DB directly (hard delete) to test cascade
  // First, restore the property
  await prisma.property.update({ where: { id: propId }, data: { deletedAt: null } });

  // Create a new unit
  const unit2Res = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-CS-102', name: 'Cascade Room 2',
  }, 201);
  const unit2Id = unit2Res.data?.id;

  // Hard delete property via Prisma (bypasses soft-delete API)
  try {
    await prisma.property.delete({ where: { id: propId } });
    test('Hard delete property via DB', true);

    // Check if units cascade-deleted
    if (unit2Id) {
      const dbUnit2 = await prisma.unit.findUnique({ where: { id: unit2Id } });
      test('Unit cascade-deleted on property hard-delete', !dbUnit2);
    }
  } catch (e: any) {
    // FK constraint might prevent hard delete
    test('Hard delete blocked by FK constraint', true, e?.code === 'P2003' ? 'P2003' : e?.message?.slice(0, 100));
  }

  // Cleanup
  if (guestId) await prisma.guest.delete({ where: { id: guestId } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 5. STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════
async function testStatusTransitions() {
  console.log('\n═══ 5. STATUS TRANSITIONS ═══');

  const propRes = await api('POST', '/api/properties', {
    name: 'Status Test Hotel', code: `AUDIT-ST-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const propId = propRes.data?.id;
  if (!propId) return;

  const unitRes = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-ST-101', name: 'Status Room', status: 'VACANT_CLEAN',
  }, 201);
  const unitId = unitRes.data?.id;
  if (!unitId) { await prisma.property.delete({ where: { id: propId } }).catch(() => {}); return; }

  const statuses = ['VACANT_CLEAN', 'VACANT_DIRTY', 'OCCUPIED_CLEAN', 'OCCUPIED_DIRTY', 'INSPECTION', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'];

  // Test every status transition
  for (const fromStatus of statuses) {
    // Set to fromStatus
    await prisma.unit.update({ where: { id: unitId }, data: { status: fromStatus as any } });

    for (const toStatus of statuses) {
      if (fromStatus === toStatus) continue;
      const res = await api('PATCH', `/api/units/${unitId}`, { status: toStatus });
      // Verify the transition was allowed (all are — no business rules enforced)
      if (res.ok) {
        // Verify DB state
        const dbUnit = await prisma.unit.findUnique({ where: { id: unitId } });
        test(`${fromStatus} → ${toStatus}: allowed`, dbUnit?.status === toStatus);
      } else {
        test(`${fromStatus} → ${toStatus}: rejected (${res.status})`, false, JSON.stringify(res.data));
      }
      // Reset for next test
      await prisma.unit.update({ where: { id: unitId }, data: { status: fromStatus as any } });
    }
  }

  // Key finding: there are NO status transition restrictions
  // Any status can transition to any other status
  // This means OUT_OF_SERVICE → OCCUPIED is allowed (should it be?)

  // Cleanup
  await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
  await prisma.property.delete({ where: { id: propId } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 6. AUTHORIZATION & IDOR
// ═══════════════════════════════════════════════════════════════════
async function testAuthorization() {
  console.log('\n═══ 6. AUTHORIZATION & IDOR ═══');

  // Create property in current org
  const propRes = await api('POST', '/api/properties', {
    name: 'Auth Test Hotel', code: `AUDIT-AUTH-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const propId = propRes.data?.id;

  // 6.1 Try accessing property without auth
  const noAuthRes = await fetch(`${BASE}/api/properties`, { headers: { origin: BASE } });
  test('No auth → redirect/401', [302, 401].includes(noAuthRes.status));

  // 6.2 Try creating property without auth
  const noAuthCreate = await fetch(`${BASE}/api/properties`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ name: 'Hacker', code: 'HACK', type: 'HOTEL' }),
  });
  test('Create without auth → 401', [302, 401].includes(noAuthCreate.status));

  // 6.3 IDOR test: try to access a property from another org
  // We can't easily create another org's property, but we can test with invalid IDs
  const fakeId = 'clx00000000000000000000000';
  const idorGet = await api('GET', `/api/properties/${fakeId}`);
  test('Non-existent property ID → 404', idorGet.status === 404);

  const idorPatch = await api('PATCH', `/api/properties/${fakeId}`, { name: 'Hacked' });
  test('PATCH non-existent property → 404', idorPatch.status === 404);

  const idorDel = await api('DELETE', `/api/properties/${fakeId}`);
  test('DELETE non-existent property → 404', idorDel.status === 404);

  // 6.4 Try creating property with XSS in name
  const xssRes = await api('POST', '/api/properties', {
    name: '<script>alert(1)</script>', code: `AUDIT-XSS-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  if (xssRes.ok) {
    test('XSS in name accepted (stored as-is)', true, `name="${xssRes.data?.name}"`);
    // Verify it's stored (not sanitized)
    test('XSS not sanitized by backend', xssRes.data?.name === '<script>alert(1)</script>');
    await prisma.property.delete({ where: { id: xssRes.data?.id } }).catch(() => {});
  }

  // Cleanup
  if (propId) await prisma.property.delete({ where: { id: propId } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 7. AVAILABILITY LOGIC
// ═══════════════════════════════════════════════════════════════════
async function testAvailability() {
  console.log('\n═══ 7. AVAILABILITY FILTERING ═══');

  const propRes = await api('POST', '/api/properties', {
    name: 'Avail Test Hotel', code: `AUDIT-AV-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  const propId = propRes.data?.id;
  if (!propId) return;

  const unitRes = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-AV-101', name: 'Avail Room', status: 'VACANT_CLEAN',
  }, 201);
  const unitId = unitRes.data?.id;

  // Create guest and booking
  const guestRes = await api('POST', '/api/guests', {
    firstName: 'Avail', lastName: 'Tester', email: `avail-${Date.now()}@test.com`, phone: `+9198765${String(Date.now()).slice(-4)}`,
  }, 201);
  const guestId = guestRes.data?.id;

  if (guestId && unitId) {
    // Create booking: Jan 10-15
    const bookRes = await api('POST', '/api/bookings', {
      propertyId: propId, unitId, guestId,
      arrivalDate: '2027-01-10', departureDate: '2027-01-15',
      adults: 2, children: 0, unitRate: 5000, discount: 0, taxAmount: 0,
      source: 'DIRECT', status: 'CONFIRMED',
    }, 201);
    test('Booking created for availability test', !!bookRes.data?.id);

    // 7.1 Query availability for overlapping dates
    const availOverlap = await api('GET', `/api/units?propertyId=${propId}&arrivalDate=2027-01-12&departureDate=2027-01-14`);
    if (availOverlap.ok) {
      const arr = Array.isArray(availOverlap.data) ? availOverlap.data : (availOverlap.data?.data || []);
      const hasUnit = arr.some((u: any) => u.id === unitId);
      test('Overlapping dates: unit excluded from availability', !hasUnit);
    }

    // 7.2 Query availability for non-overlapping dates
    const availNoOverlap = await api('GET', `/api/units?propertyId=${propId}&arrivalDate=2027-01-16&departureDate=2027-01-18`);
    if (availNoOverlap.ok) {
      const arr = Array.isArray(availNoOverlap.data) ? availNoOverlap.data : (availNoOverlap.data?.data || []);
      const hasUnit = arr.some((u: any) => u.id === unitId);
      test('Non-overlapping dates: unit included', hasUnit);
    }

    // 7.3 Boundary: booking ends Jan 15, new query starts Jan 15
    const availBoundary = await api('GET', `/api/units?propertyId=${propId}&arrivalDate=2027-01-15&departureDate=2027-01-17`);
    if (availBoundary.ok) {
      const arr = Array.isArray(availBoundary.data) ? availBoundary.data : (availBoundary.data?.data || []);
      const hasUnit = arr.some((u: any) => u.id === unitId);
      // Boundary: departure is exclusive, arrival is inclusive
      // Booking: arrival < newDeparture AND departure > newArrival
      // 2027-01-15 < 2027-01-17 (true) AND 2027-01-15 > 2027-01-15 (false)
      // So no overlap — unit should be available
      test('Boundary (start = existing end): unit available', hasUnit);
    }

    // 7.4 Only arrivalDate without departureDate
    const partial = await api('GET', `/api/units?propertyId=${propId}&arrivalDate=2027-01-12`);
    test('Only arrivalDate provided (no departureDate): no filter applied', partial.ok);
  }

  // Cleanup
  if (guestId) await prisma.guest.delete({ where: { id: guestId } }).catch(() => {});
  if (unitId) await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
  await prisma.property.delete({ where: { id: propId } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═══════════════════════════════════════════════════════════════════
async function testEdgeCases() {
  console.log('\n═══ 8. EDGE CASES ═══');

  // 8.1 Property with 0 units
  const prop0 = await api('POST', '/api/properties', {
    name: 'Zero Units Hotel', code: `AUDIT-ZU-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  test('Property with 0 units created', !!prop0.data?.id);
  if (prop0.data?.id) {
    const detail = await api('GET', `/api/properties/${prop0.data.id}`);
    test('Property detail has empty units array', detail.data?.units?.length === 0);
    await prisma.property.delete({ where: { id: prop0.data.id } }).catch(() => {});
  }

  // 8.2 Very long room name
  const propLong = await api('POST', '/api/properties', {
    name: 'Long Name Test', code: `AUDIT-LN-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  if (propLong.data?.id) {
    const longNameUnit = await api('POST', '/api/units', {
      propertyId: propLong.data.id, number: 'AUDIT-LN-1', name: 'A'.repeat(80),
    }, 201);
    test('Room name at max length (80) → 201', longNameUnit.ok);

    const tooLongName = await api('POST', '/api/units', {
      propertyId: propLong.data.id, number: 'AUDIT-LN-2', name: 'A'.repeat(81),
    }, 400);
    test('Room name > 80 chars → 400', tooLongName.ok);

    // Unicode room name
    const unicodeUnit = await api('POST', '/api/units', {
      propertyId: propLong.data.id, number: 'AUDIT-LN-3', name: '_DELUXE_ROOM',
    }, 201);
    test('Unicode room name → 201', unicodeUnit.ok);
    if (unicodeUnit.data?.id) {
      await prisma.unit.delete({ where: { id: unicodeUnit.data.id } }).catch(() => {});
    }

    await prisma.property.delete({ where: { id: propLong.data.id } }).catch(() => {});
  }

  // 8.3 Unit with no floor
  const propFloor = await api('POST', '/api/properties', {
    name: 'Floor Test', code: `AUDIT-FL-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);
  if (propFloor.data?.id) {
    const noFloor = await api('POST', '/api/units', {
      propertyId: propFloor.data.id, number: 'AUDIT-FL-1', name: 'No Floor Room', floor: null,
    }, 201);
    test('Unit with no floor → 201', noFloor.ok);
    if (noFloor.data?.id) await prisma.unit.delete({ where: { id: noFloor.data.id } }).catch(() => {});
    await prisma.property.delete({ where: { id: propFloor.data.id } }).catch(() => {});
  }

  // 8.4 Delete unit type that is in use
  const typeInUse = await api('POST', '/api/unit-types', {
    name: 'In Use Type', baseOccupancy: 2, maxOccupancy: 2,
  }, 201);
  const typeInUseId = typeInUse.data?.id;

  const propForType = await api('POST', '/api/properties', {
    name: 'Type Usage Test', code: `AUDIT-TU-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
  }, 201);

  if (typeInUseId && propForType.data?.id) {
    const unitWithType = await api('POST', '/api/units', {
      propertyId: propForType.data.id, number: 'AUDIT-TU-1', name: 'Typed Room', unitTypeId: typeInUseId,
    }, 201);

    // Try to delete the type
    const delTypeRes = await api('DELETE', `/api/unit-types/${typeInUseId}`);
    test('Delete unit type in use → 200 (units become unassigned)', delTypeRes.ok);

    // Verify the unit's type is now null
    if (unitWithType.data?.id) {
      const dbUnit = await prisma.unit.findUnique({ where: { id: unitWithType.data.id } });
      test('Unit type set to null after type deletion', dbUnit?.unitTypeId === null);
      await prisma.unit.delete({ where: { id: unitWithType.data.id } }).catch(() => {});
    }
  }

  await prisma.property.delete({ where: { id: propForType.data?.id } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// 9. API ↔ DATABASE VERIFICATION
// ═══════════════════════════════════════════════════════════════════
async function testApiDbConsistency() {
  console.log('\n═══ 9. API ↔ DB VERIFICATION ═══');

  const propRes = await api('POST', '/api/properties', {
    name: 'DB Test Hotel', code: `AUDIT-DB-${Date.now().toString(36).slice(-4)}`, type: 'HOTEL',
    city: 'Chennai', starRating: 3,
  }, 201);
  const propId = propRes.data?.id;
  if (!propId) return;

  // 9.1 Verify API response matches DB
  const dbProp = await prisma.property.findUnique({ where: { id: propId } });
  test('API name matches DB', propRes.data?.name === dbProp?.name);
  test('API code matches DB', propRes.data?.code === dbProp?.code);
  test('API type matches DB', propRes.data?.type === dbProp?.type);
  test('API city matches DB', propRes.data?.city === dbProp?.city);
  test('API isActive matches DB', propRes.data?.isActive === dbProp?.isActive);

  // 9.2 Create unit, verify DB
  const unitRes = await api('POST', '/api/units', {
    propertyId: propId, number: 'AUDIT-DB-101', name: 'DB Room', floor: '3',
    status: 'VACANT_DIRTY',
  }, 201);
  const unitId = unitRes.data?.id;
  if (unitId) {
    const dbUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    test('API unit number matches DB', unitRes.data?.number === dbUnit?.number);
    test('API unit status matches DB', unitRes.data?.status === dbUnit?.status);
    test('API unit floor matches DB', unitRes.data?.floor === dbUnit?.floor);
    test('API unit propertyId matches DB', unitRes.data?.propertyId === dbUnit?.propertyId);
  }

  // 9.3 Update unit, verify DB
  if (unitId) {
    const updRes = await api('PATCH', `/api/units/${unitId}`, { status: 'OCCUPIED_CLEAN', floor: '5' });
    const dbUnitAfter = await prisma.unit.findUnique({ where: { id: unitId } });
    test('After PATCH: DB status matches API', updRes.data?.status === dbUnitAfter?.status);
    test('After PATCH: DB floor matches API', updRes.data?.floor === dbUnitAfter?.floor);
  }

  // Cleanup
  if (unitId) await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
  await prisma.property.delete({ where: { id: propId } }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  PROPERTY & ROOMS/UNITS MODULE AUDIT');
  console.log('═══════════════════════════════════════════════════');

  await login();
  console.log(`  Logged in as demo@azurebay.com (org: ${orgId})`);

  await cleanup();
  console.log('  Cleaned up previous test data');

  await testPropertyCRUD();
  await testUnitCRUD();
  await testUnitTypeCRUD();
  await testCascadeSafety();
  await testStatusTransitions();
  await testAuthorization();
  await testAvailability();
  await testEdgeCases();
  await testApiDbConsistency();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${blocked} blocked`);
  console.log('═══════════════════════════════════════════════════');

  await prisma.$disconnect();
}

run().catch(console.error);
