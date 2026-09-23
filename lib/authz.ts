// Central page-level authorization rules.
// Imported by middleware (edge runtime safe: no node APIs).

export const ALL_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPER', 'ACCOUNTANT'] as const;

export const PAGE_ROLES: [string, string[]][] = [
  ['/dashboard', [...ALL_ROLES]],
  ['/dashboard/admin/settings', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/admin/security', ['OWNER', 'ADMIN']],
  ['/dashboard/admin/integrations', ['OWNER', 'ADMIN']],
  ['/dashboard/admin/notifications', [...ALL_ROLES]],
  ['/dashboard/staff', ['OWNER', 'ADMIN']],
  ['/dashboard/revenue/rate-plans', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/revenue/rates', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/properties/units', [...ALL_ROLES]],
  ['/dashboard/properties', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/operations/maintenance', ['OWNER', 'ADMIN', 'MANAGER']],
  ['/dashboard/operations/housekeeping', [...ALL_ROLES]],
  ['/dashboard/finance/invoices', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/finance/payments', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/finance/expenses', ['OWNER', 'ADMIN', 'ACCOUNTANT']],
  ['/dashboard/reports', ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']],
  ['/dashboard/reservations/calendar', [...ALL_ROLES]],
  ['/dashboard/reservations/bookings', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST']],
  ['/dashboard/reservations/guests', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']],
  ['/dashboard/admin/plan', ['OWNER', 'ADMIN']],
];

/**
 * Whether a user with the given role may open this dashboard path.
 * Paths without an entry are denied (default-deny).
 * Rules are sorted by longest prefix first so specific paths match before their parent prefixes.
 */
const SORTED_ROLES = [...PAGE_ROLES].sort((a, b) => b[0].length - a[0].length);

export function pageAllowed(pathname: string, role: string): boolean {
  for (const [prefix, roles] of SORTED_ROLES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return roles.includes(role);
    }
  }
  return false;
}
