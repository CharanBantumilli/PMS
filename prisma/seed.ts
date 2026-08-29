import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding…');

  const password = await bcrypt.hash('demo1234', 12);
  const org = await prisma.organization.upsert({
    where: { slug: 'azure-bay' },
    update: {},
    create: {
      name: 'Azure Bay Hotels',
      slug: 'azure-bay',
      email: 'demo@azurebay.com',
      phone: '+91 98200 12345',
      website: 'https://azurebay.example.in',
      addressLine1: '247 Beach Road, Candolim',
      city: 'Goa',
      state: 'Goa',
      postalCode: '403515',
      country: 'IN',
      currency: 'INR',
      plan: 'PROFESSIONAL',
      planStatus: 'ACTIVE',
      maxProperties: 10, maxUsers: 25, maxUnits: 1000,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@azurebay.com' },
    update: { hashedPassword: password, organizationId: org.id, role: 'OWNER', status: 'ACTIVE' },
    create: { email: 'demo@azurebay.com', name: 'Demo Owner', hashedPassword: password, organizationId: org.id, role: 'OWNER', status: 'ACTIVE' },
  });

  // Unit types
  const standard = await prisma.unitTypeDefinition.upsert({
    where: { id: 'seed-standard' },
    update: {},
    create: { id: 'seed-standard', organizationId: org.id, name: 'Standard Queen', basePrice: 129, baseOccupancy: 2, maxOccupancy: 2, bedType: 'QUEEN', bedCount: 1, bathroomCount: 1 },
  });
  const deluxe = await prisma.unitTypeDefinition.upsert({
    where: { id: 'seed-deluxe' },
    update: {},
    create: { id: 'seed-deluxe', organizationId: org.id, name: 'Deluxe King', basePrice: 199, baseOccupancy: 2, maxOccupancy: 3, bedType: 'KING', bedCount: 1, bathroomCount: 1 },
  });
  const suite = await prisma.unitTypeDefinition.upsert({
    where: { id: 'seed-suite' },
    update: {},
    create: { id: 'seed-suite', organizationId: org.id, name: 'Ocean Suite', basePrice: 349, baseOccupancy: 2, maxOccupancy: 4, bedType: 'KING', bedCount: 1, bathroomCount: 2 },
  });

  // Property
  const prop = await prisma.property.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'ABR' } },
    update: {},
    create: {
      organizationId: org.id, name: 'Azure Bay Resort', code: 'ABR', type: 'RESORT', starRating: 4,
      addressLine1: '247 Beach Road, Candolim', city: 'Goa', state: 'Goa', country: 'IN', postalCode: '403515',
      phone: '+91 98200 12345', email: 'reservations@azurebay.com',
      checkInTime: '14:00', checkOutTime: '11:00',
      description: 'Beachfront resort on Candolim beach with Arabian Sea views, infinity pool and spa.',
    },
  });

  // Units
  const floors = [1, 2, 3, 4];
  let n = 100;
  for (const f of floors) {
    for (let i = 1; i <= 6; i++) {
      const num = (f * 100 + i).toString();
      const type = f === 4 ? suite : f === 3 ? deluxe : standard;
      await prisma.unit.upsert({
        where: { propertyId_number: { propertyId: prop.id, number: num } },
        update: {},
        create: { organizationId: org.id, propertyId: prop.id, unitTypeId: type.id, name: `Room ${num}`, number: num, floor: f.toString(), status: 'VACANT_CLEAN' },
      });
    }
  }

  // Guests
  const guestNames = [
    ['Arjun','Mehta'], ['Priya','Sharma'], ['Rahul','Verma'], ['Ananya','Iyer'],
    ['Vikram','Nair'], ['Kavya','Reddy'], ['Rohan','Joshi'], ['Diya','Kapoor'],
  ];
  const guests = [];
  for (const [f, l] of guestNames) {
    const g = await prisma.guest.upsert({
      where: { id: `seed-guest-${f.toLowerCase()}-${l.toLowerCase()}` },
      update: {},
      create: { id: `seed-guest-${f.toLowerCase()}-${l.toLowerCase()}`, organizationId: org.id, firstName: f, lastName: l, email: `${f.toLowerCase()}.${l.toLowerCase()}@example.com`, phone: `+91 98${(10000000 + Math.floor(Math.random() * 89999999)).toString().slice(0, 8)}`, country: 'IN' },
    });
    guests.push(g);
  }

  // Rate plan
  await prisma.ratePlan.upsert({
    where: { id: 'seed-rp-flex' },
    update: {},
    create: { id: 'seed-rp-flex', organizationId: org.id, propertyId: prop.id, name: 'Flexible Rate', basePrice: 149, isRefundable: true, minStay: 1, mealsIncluded: 'none' },
  });

  // Bookings
  const unitList = await prisma.unit.findMany({ where: { propertyId: prop.id } });
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const g = guests[i % guests.length];
    const u = unitList[i % unitList.length];
    const arr = new Date(today); arr.setDate(arr.getDate() + i - 2);
    const dep = new Date(arr); dep.setDate(dep.getDate() + (2 + (i % 3)));
    const nights = Math.round((dep.getTime() - arr.getTime()) / 86400000);
    const total = nights * 149;
    const code = `SEED${(1000 + i).toString()}`;
    const status = i === 0 ? 'CHECKED_IN' : i === 1 ? 'CHECKED_OUT' : 'CONFIRMED';
    await prisma.booking.upsert({
      where: { confirmationCode: code },
      update: {},
      create: {
        organizationId: org.id, propertyId: prop.id, unitId: u.id, guestId: g.id, createdById: user.id,
        confirmationCode: code, status, source: (['DIRECT','AIRBNB','BOOKING_COM','WALK_IN'] as const)[i % 4],
        arrivalDate: arr, departureDate: dep, nights,
        adults: 1 + (i % 3), children: i % 2,
        unitRate: 149, totalAmount: total, taxAmount: total * 0.12, discount: 0, paidAmount: status === 'CHECKED_OUT' ? total : 0, balance: status === 'CHECKED_OUT' ? 0 : total, currency: 'INR',
      },
    });
    // keep unit status consistent with the seeded booking state
    const unitStatus = status === 'CHECKED_IN' ? 'OCCUPIED_CLEAN' : status === 'CHECKED_OUT' ? 'VACANT_DIRTY' : null;
    if (unitStatus) {
      await prisma.unit.update({ where: { id: u.id }, data: { status: unitStatus } }).catch(() => {});
    }
  }

  // Housekeeping
  const hkUnits = unitList.slice(0, 4);
  for (let i = 0; i < hkUnits.length; i++) {
    const u = hkUnits[i];
    const status = i === 0 ? 'IN_PROGRESS' : i === 1 ? 'PENDING' : 'PENDING';
    await prisma.housekeepingTask.create({
      data: {
        organizationId: org.id, propertyId: prop.id, unitId: u.id,
        type: 'FULL_CLEAN', status, priority: 5 + i,
        createdById: user.id,
        scheduledFor: new Date(),
      },
    });
  }

  // Maintenance
  await prisma.maintenanceTicket.create({
    data: {
      organizationId: org.id, unitId: hkUnits[2].id,
      title: 'Leaking shower head', description: 'Shower head drips continuously, needs new cartridge.', priority: 'MEDIUM', status: 'OPEN', category: 'Plumbing', createdById: user.id,
    },
  });

  // Expenses
  await prisma.expense.create({ data: { organizationId: org.id, category: 'UTILITIES', description: 'Electricity bill - May', amount: 1240, expenseDate: new Date(), vendor: 'City Power' } });
  await prisma.expense.create({ data: { organizationId: org.id, category: 'SUPPLIES', description: 'Toiletries and linens', amount: 480, expenseDate: new Date(), vendor: 'HotelSupply Co' } });

  console.log('Seed complete.');
  console.log('Login: demo@azurebay.com / demo1234');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
