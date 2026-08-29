import { describe, it, expect } from 'vitest';
import { pageAllowed, PAGE_ROLES } from '@/lib/authz';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'ACCOUNTANT'] as const;

// Expected matrix distilled from the product's access policy.
// path prefix -> roles that may open it (others denied).
const EXPECTED: [string, string[]][] = [
  ['/dashboard/settings', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/security', ['OWNER', 'ADMIN']],
  ['/dashboard/integrations', ['OWNER', 'ADMIN']],
  ['/dashboard/guests-staff', ['OWNER', 'ADMIN']],
  ['/dashboard/channels', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/rate-plans', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/rates', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/properties', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/maintenance', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/invoices', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/payments', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/expenses', ['OWNER', 'ADMIN', 'ACCOUNTANT']],
  ['/dashboard/reports', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/bookings', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST']],
  ['/dashboard/guests', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']],
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
    '/dashboard/notifications',
    '/dashboard/calendar',
    '/dashboard/housekeeping',
    '/dashboard/housekeeping/anything',
    '/dashboard/units',
    '/dashboard/units/new',
    '/dashboard/units/types',
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
    expect(pageAllowed('/dashboard/guests/gst_123', 'ACCOUNTANT')).toBe(true);
    expect(pageAllowed('/dashboard/guests/gst_123', 'HOUSEKEEPER')).toBe(false);
    expect(pageAllowed('/dashboard/guests/gst_123', 'RECEPTIONIST')).toBe(true);
  });

  it('trailing slash behaves like the exact page', () => {
    expect(pageAllowed('/dashboard/settings/', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/settings/', 'RECEPTIONIST')).toBe(false);
  });

  it('prefix collisions do not leak: /dashboard/guests-staff is NOT /dashboard/guests', () => {
    // ACCOUNTANT has guests access but must not gain guests-staff through the shared prefix
    expect(pageAllowed('/dashboard/guests-staff', 'ACCOUNTANT')).toBe(false);
    expect(pageAllowed('/dashboard/guests-staff', 'HOUSEKEEPER')).toBe(false);
    expect(pageAllowed('/dashboard/guests-staff', 'OWNER')).toBe(true);
  });

  it('rates vs rate-plans prefixes are independent', () => {
    // both restrict ACCOUNTANT, but MANAGER gets both while RECEPTIONIST gets neither
    expect(pageAllowed('/dashboard/rate-plans', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/rates', 'MANAGER')).toBe(true);
    expect(pageAllowed('/dashboard/rate-plans', 'RECEPTIONIST')).toBe(false);
    expect(pageAllowed('/dashboard/rates', 'RECEPTIONIST')).toBe(false);
  });
});

describe('pageAllowed — superadmin bypass & unknown roles', () => {
  it('superadmin opens everything, even restricted pages with an unknown role', () => {
    for (const [path] of PAGE_ROLES) {
      expect(pageAllowed(path, '', true)).toBe(true);
    }
  });

  it('unknown role defaults to denial on restricted pages', () => {
    expect(pageAllowed('/dashboard/settings', 'STAFF')).toBe(false);
    expect(pageAllowed('/dashboard/security', '')).toBe(false);
  });
});

describe('PAGE_ROLES integrity', () => {
  it('every dashboard page in the sidebar matrix has a rule or is intentionally open', () => {
    const guarded = new Set(PAGE_ROLES.map(([p]) => p));
    // These are intentionally open to all authenticated roles:
    const intentionallyOpen = new Set([
      '/dashboard', '/dashboard/notifications', '/dashboard/calendar',
      '/dashboard/housekeeping', '/dashboard/units',
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
