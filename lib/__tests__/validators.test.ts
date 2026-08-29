import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  propertySchema,
  unitSchema,
  unitTypeSchema,
  ratePlanSchema,
  guestSchema,
  bookingSchema,
  paymentSchema,
  expenseSchema,
  housekeepingTaskSchema,
  maintenanceSchema,
  inviteSchema,
} from '@/lib/validators';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test Hotel',
      organizationSlug: 'test-hotel',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test',
      organizationSlug: 'Test With Spaces!',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts without optional country and currency', () => {
    const result = registerSchema.parse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
    });
    expect(result.country).toBeUndefined();
    expect(result.currency).toBeUndefined();
  });

  it('uppercases currency when provided', () => {
    const result = registerSchema.parse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
      currency: 'inr',
    });
    expect(result.currency).toBe('INR');
  });

  it('rejects non-INR currencies (INR-only launch)', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid ISO country codes', () => {
    const result = registerSchema.safeParse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
      country: 'ZZ',
    });
    expect(result.success).toBe(false);
  });

  it('normalizes lowercase country codes', () => {
    const result = registerSchema.parse({
      organizationName: 'Test',
      organizationSlug: 'test',
      name: 'Alex',
      email: 'alex@test.com',
      password: 'password123',
      country: 'in',
    });
    expect(result.country).toBe('IN');
  });
});

describe('propertySchema', () => {
  it('accepts a valid property', () => {
    const result = propertySchema.safeParse({
      name: 'Azure Bay Resort',
      code: 'ABR',
      type: 'RESORT',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = propertySchema.safeParse({ code: 'ABR', type: 'HOTEL' });
    expect(result.success).toBe(false);
  });

  it('requires type to be valid enum', () => {
    const result = propertySchema.safeParse({ name: 'Test', code: 'T', type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects code with special characters', () => {
    const result = propertySchema.safeParse({ name: 'Test', code: 'AB R!', type: 'HOTEL' });
    expect(result.success).toBe(false);
  });

  it('applies default amenities array', () => {
    const result = propertySchema.parse({ name: 'Test', code: 'T', type: 'HOTEL' });
    expect(result.amenities).toEqual([]);
  });
});

describe('unitSchema', () => {
  const validUnit = {
    propertyId: 'prop-1',
    name: 'Deluxe Suite',
    number: '101',
  };

  it('accepts a valid unit', () => {
    expect(unitSchema.safeParse(validUnit).success).toBe(true);
  });

  it('rejects missing name', () => {
    expect(unitSchema.safeParse({ ...validUnit, name: '' }).success).toBe(false);
  });

  it('applies default status', () => {
    const result = unitSchema.parse(validUnit);
    expect(result.status).toBe('VACANT_CLEAN');
  });

  it('rejects invalid status', () => {
    expect(unitSchema.safeParse({ ...validUnit, status: 'BROKEN' }).success).toBe(false);
  });
});

describe('unitTypeSchema', () => {
  const valid = { name: 'Standard Queen', basePrice: 129 };

  it('accepts a valid unit type', () => {
    expect(unitTypeSchema.safeParse(valid).success).toBe(true);
  });

  it('applies default occupancy values', () => {
    const result = unitTypeSchema.parse(valid);
    expect(result.baseOccupancy).toBe(2);
    expect(result.maxOccupancy).toBe(2);
    expect(result.bedCount).toBe(1);
    expect(result.bathroomCount).toBe(1);
    expect(result.bedType).toBe('QUEEN');
  });

  it('rejects negative price', () => {
    expect(unitTypeSchema.safeParse({ name: 'Test', basePrice: -10 }).success).toBe(false);
  });
});

describe('ratePlanSchema', () => {
  it('accepts a valid rate plan', () => {
    const result = ratePlanSchema.safeParse({ name: 'Flexible Rate', basePrice: 149 });
    expect(result.success).toBe(true);
  });

  it('applies defaults', () => {
    const result = ratePlanSchema.parse({ name: 'Test', basePrice: 100 });
    expect(result.minStay).toBe(1);
    expect(result.isRefundable).toBe(true);
    expect(result.mealsIncluded).toBe('none');
    expect(result.isActive).toBe(true);
  });
});

describe('guestSchema', () => {
  it('requires first and last name', () => {
    expect(guestSchema.safeParse({ firstName: 'Alex' }).success).toBe(false);
    expect(guestSchema.safeParse({ lastName: 'Morgan' }).success).toBe(false);
  });

  it('accepts minimal valid guest', () => {
    expect(guestSchema.safeParse({ firstName: 'Alex', lastName: 'Morgan' }).success).toBe(true);
  });

  it('clamps VIP level to 0-5', () => {
    const tooHigh = guestSchema.safeParse({ firstName: 'A', lastName: 'B', vipLevel: 10 });
    expect(tooHigh.success).toBe(false);
    const neg = guestSchema.safeParse({ firstName: 'A', lastName: 'B', vipLevel: -1 });
    expect(neg.success).toBe(false);
  });
});

describe('bookingSchema', () => {
  const validBooking = {
    propertyId: 'p1',
    guestId: 'g1',
    arrivalDate: '2026-09-01',
    departureDate: '2026-09-03',
    adults: 2,
    children: 0,
    unitRate: 150,
  };

  it('accepts a valid booking', () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it('requires arrival date', () => {
    const { arrivalDate, ...rest } = validBooking;
    expect(bookingSchema.safeParse(rest).success).toBe(false);
  });

  it('applies default adults to 1', () => {
    const { adults, ...rest } = validBooking;
    const result = bookingSchema.parse(rest);
    expect(result.adults).toBe(1);
  });

  it('rejects non-positive adults', () => {
    expect(bookingSchema.safeParse({ ...validBooking, adults: 0 }).success).toBe(false);
  });
});

describe('paymentSchema', () => {
  it('accepts a valid payment', () => {
    const result = paymentSchema.safeParse({ amount: 100, method: 'CARD', status: 'PAID' });
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    expect(paymentSchema.safeParse({ amount: -10, method: 'CARD' }).success).toBe(false);
  });

  it('requires method', () => {
    expect(paymentSchema.safeParse({ amount: 100 }).success).toBe(false);
  });
});

describe('expenseSchema', () => {
  it('accepts a valid expense', () => {
    const result = expenseSchema.safeParse({
      category: 'UTILITIES', description: 'Electricity', amount: 100, expenseDate: '2026-08-01',
    });
    expect(result.success).toBe(true);
  });

  it('requires category', () => {
    expect(expenseSchema.safeParse({
      description: 'Test', amount: 100, expenseDate: '2026-08-01',
    }).success).toBe(false);
  });
});

describe('housekeepingTaskSchema', () => {
  it('accepts a valid task', () => {
    const result = housekeepingTaskSchema.safeParse({
      propertyId: 'p1', unitId: 'u1', type: 'FULL_CLEAN', priority: 5,
    });
    expect(result.success).toBe(true);
  });

  it('clamps priority 1-10', () => {
    expect(housekeepingTaskSchema.safeParse({ propertyId: 'p', unitId: 'u', priority: 0 }).success).toBe(false);
    expect(housekeepingTaskSchema.safeParse({ propertyId: 'p', unitId: 'u', priority: 11 }).success).toBe(false);
  });
});

describe('maintenanceSchema', () => {
  it('accepts a valid ticket', () => {
    const result = maintenanceSchema.safeParse({
      unitId: 'u1', title: 'Broken AC', description: 'Not cooling', priority: 'HIGH',
    });
    expect(result.success).toBe(true);
  });

  it('requires title and description', () => {
    expect(maintenanceSchema.safeParse({ unitId: 'u1', description: 'desc' }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ unitId: 'u1', title: 't' }).success).toBe(false);
  });
});

describe('inviteSchema', () => {
  it('accepts a valid invite', () => {
    const result = inviteSchema.safeParse({ email: 'staff@hotel.com', role: 'RECEPTIONIST' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(inviteSchema.safeParse({ email: 'a@b.com', role: 'SUPERUSER' }).success).toBe(false);
  });
});
