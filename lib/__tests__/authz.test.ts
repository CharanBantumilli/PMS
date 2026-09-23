import { describe, it, expect } from 'vitest';
import { pageAllowed, PAGE_ROLES } from '@/lib/authz';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'ACCOUNTANT'] as const;

// Expected matrix distilled from the product's access policy.
// path prefix -> roles that may open it (others denied).
const EXPECTED: [string, string[]][] = [
  ['/dashboard/admin/settings', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/admin/security', ['OWNER', 'ADMIN']],
  ['/dashboard/admin/integrations', ['OWNER', 'ADMIN']],
  ['/dashboard/admin/notifications', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'ACCOUNTANT']],
  ['/dashboard/staff', ['OWNER', 'ADMIN']],
  ['/dashboard/revenue/rate-plans', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/revenue/rates', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/properties', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/operations/maintenance', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/finance/invoices', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/finance/payments', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/finance/expenses', ['OWNER', 'ADMIN', 'ACCOUNTANT']],
  ['/dashboard/reports', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/reservations/bookings', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST']],
  ['/dashboard/reservations/guests', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']],
];

describe('pageAllowed — full role × page matrix', () => {
  for (const [path, allowedRoles] of EXPECTED) {
    for (const role of ROLES) {
      const shouldAllow = allowedRoles.includes(role);
      it(`${role} ${shouldAllow ? 'ALLOWED' : 'DENIED '} ${path}`, () => {
        expect(pageAllowed(path, role)).toBe(shouldAllow);
      });
    }
  }
});

describe('pageAllowed — open pages', () => {
  const OPEN_PATHS = [
    '/dashboard',
    '/dashboard/',
    '/dashboard/reservations/calendar',
    '/dashboard/operations/housekeeping',
    '/dashboard/properties/units',
    '/dashboard/properties/units/new',
    '/dashboard/properties/units/types',
  ];
  for (const p of OPEN_PATHS) {
    for (const role of ROLES) {
      it(`${role} ALLOWED ${p} (no restriction entry)`, () => {
        expect(pageAllowed(p, role)).toBe(true);
      });
    }
  }
});

describe('pageAllowed — sub-path inheritance', () => {
  it('guest detail pages follow guests rules', () => {
    expect(pageAllowed('/dashboard/reservations/guests/gst_123', 'ACCOUNTANT')).toBe(true);
    expect(pageAllowed('/dashboard/reservations/guests/gst_123', 'HOUSEKEEPER')).toBe(false);
    expect(pageAllowed('/dashboard/reservations/guests/gst_123', 'RECEPTIONIST')).toBe(true);
  });

  it('trailing slash behaves like the exact page', () => {
    expect(pageAllowed('/dashboard/admin/settings/', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/admin/settings/', 'RECEPTIONIST')).toBe(false);
  });

  it('staff is independent from guests', () => {
    expect(pageAllowed('/dashboard/staff', 'ACCOUNTANT')).toBe(false);
    expect(pageAllowed('/dashboard/staff', 'HOUSEKEEPER')).toBe(false);
    expect(pageAllowed('/dashboard/staff', 'OWNER')).toBe(true);
  });

  it('rates vs rate-plans prefixes are independent', () => {
    expect(pageAllowed('/dashboard/revenue/rate-plans', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/revenue/rates', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/revenue/rate-plans', 'RECEPTIONIST')).toBe(false);
    expect(pageAllowed('/dashboard/revenue/rates', 'RECEPTIONIST')).toBe(false);
  });
});

describe('pageAllowed — unknown roles', () => {
  it('unknown role defaults to denial on restricted pages', () => {
    expect(pageAllowed('/dashboard/admin/settings', 'STAFF')).toBe(false);
    expect(pageAllowed('/dashboard/admin/security', '')).toBe(false);
  });
});

describe('PAGE_ROLES integrity', () => {
  it('every dashboard page in the sidebar matrix has a rule or is intentionally open', () => {
    const guarded = new Set(PAGE_ROLES.map(([p]) => p));
    const intentionallyOpen = new Set([
      '/dashboard', '/dashboard/reservations/calendar',
      '/dashboard/operations/housekeeping', '/dashboard/properties/units',
    ]);
    for (const p of EXPECTED.map(([p]) => p)) {
      expect(guarded.has(p) || intentionallyOpen.has(p)).toBe(true);
    }
  });

  it('every role list only contains valid roles and grants OWNER+ADMIN', () => {
    for (const [, roles] of PAGE_ROLES) {
      expect(roles.length).toBeGreaterThan(0);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('ADMIN');
      for (const r of roles) expect(ROLES).toContain(r as any);
    }
  });
});
