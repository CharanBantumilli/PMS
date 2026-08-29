// Central page-level authorization rules.
// Imported by middleware (edge runtime safe: no node APIs).

export const PAGE_ROLES: [string, string[]][] = [
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
  ['/dashboard/guests/', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']],
  ['/dashboard/guests', ['OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']],
];

/**
 * Whether a user with the given role may open this dashboard path.
 * Paths without an entry are open to every authenticated role.
 */
export function pageAllowed(pathname: string, role: string, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  for (const [prefix, roles] of PAGE_ROLES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return roles.includes(role);
    }
  }
  return true;
}
