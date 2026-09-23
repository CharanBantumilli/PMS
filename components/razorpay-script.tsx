'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const PAYMENT_PATHS = ['/dashboard/finance', '/api/payments'];

export function RazorpayScript() {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (PAYMENT_PATHS.some((p) => pathname?.startsWith(p))) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      document.head.appendChild(s);
      setLoaded(true);
    }
  }, [pathname, loaded]);

  return null;
}
