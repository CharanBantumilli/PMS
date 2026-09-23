/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: (process.env.ALLOWED_ORIGINS || 'localhost:3000').split(',') },
  },
  async redirects() {
    return [
      { source: '/dashboard/calendar', destination: '/dashboard/reservations/calendar', permanent: true },
      { source: '/dashboard/bookings', destination: '/dashboard/reservations/bookings', permanent: true },
      { source: '/dashboard/bookings/:path*', destination: '/dashboard/reservations/bookings/:path*', permanent: true },
      { source: '/dashboard/guests', destination: '/dashboard/reservations/guests', permanent: true },
      { source: '/dashboard/guests/:path*', destination: '/dashboard/reservations/guests/:path*', permanent: true },
      { source: '/dashboard/units', destination: '/dashboard/properties/units', permanent: true },
      { source: '/dashboard/units/:path*', destination: '/dashboard/properties/units/:path*', permanent: true },
      { source: '/dashboard/housekeeping', destination: '/dashboard/operations/housekeeping', permanent: true },
      { source: '/dashboard/maintenance', destination: '/dashboard/operations/maintenance', permanent: true },
      { source: '/dashboard/payments', destination: '/dashboard/finance/payments', permanent: true },
      { source: '/dashboard/invoices', destination: '/dashboard/finance/invoices', permanent: true },
      { source: '/dashboard/invoices/:path*', destination: '/dashboard/finance/invoices/:path*', permanent: true },
      { source: '/dashboard/expenses', destination: '/dashboard/finance/expenses', permanent: true },
      { source: '/dashboard/rate-plans', destination: '/dashboard/revenue/rate-plans', permanent: true },
      { source: '/dashboard/rates', destination: '/dashboard/revenue/rates', permanent: true },
      { source: '/dashboard/guests-staff', destination: '/dashboard/staff', permanent: true },
      { source: '/dashboard/notifications', destination: '/dashboard/admin/notifications', permanent: true },
      { source: '/dashboard/settings', destination: '/dashboard/admin/settings', permanent: true },
      { source: '/dashboard/security', destination: '/dashboard/admin/security', permanent: true },
      { source: '/dashboard/integrations', destination: '/dashboard/admin/integrations', permanent: true },
    ];
  },
};

module.exports = nextConfig;
