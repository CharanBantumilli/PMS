import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'PMS — Modern Property Management',
  description: 'A production-grade property management system for hotels, hostels, vacation rentals and serviced apartments.',
  applicationName: 'PMS',
  authors: [{ name: 'PMS SaaS' }],
  keywords: ['PMS', 'property management', 'hotel', 'hostel', 'vacation rental', 'SaaS'],
  openGraph: {
    title: 'PMS — Modern Property Management',
    description: 'A production-grade property management system for hotels, hostels, vacation rentals and serviced apartments.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable + ' min-h-screen bg-background font-sans antialiased'}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#0f172a', color: '#fff', borderRadius: 8, fontSize: 14 },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
