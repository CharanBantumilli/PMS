'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type SSEEvent = {
  event: string;
  data: any;
};

export function useRealtimeEvents(opts: {
  onBookingCreated?: (data: any) => void;
  onUnitStatusChanged?: (data: any) => void;
  onNotificationNew?: (data: any) => void;
  enabled?: boolean;
} = {}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(opts);
  handlersRef.current = opts;

  useEffect(() => {
    if (opts.enabled === false) return undefined;

    let es: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      es = new EventSource('/api/stream');

      es.addEventListener('connected', () => setConnected(true));
      es.addEventListener('ping', () => {});

      es.addEventListener('booking.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onBookingCreated?.(data);
        } catch {}
      });

      es.addEventListener('unit.statusChanged', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onUnitStatusChanged?.(data);
        } catch {}
      });

      es.addEventListener('notification.new', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onNotificationNew?.(data);
          // Auto-refresh the notification bell
          window.dispatchEvent(new CustomEvent('realtime-notification', { detail: data }));
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es?.close();
        // Reconnect after 3s
        reconnectRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      es?.close();
    };
  }, [opts.enabled]);

  return { connected };
}

/**
 * Hook that auto-refreshes the page when real-time events arrive.
 * Use on dashboard, units, bookings, etc. for shared workspace live updates.
 */
export function useLiveRefresh(events: string[] = ['booking.created', 'unit.statusChanged', 'notification.new']) {
  const router = useRouter();
  useRealtimeEvents({
    onBookingCreated: () => router.refresh(),
    onUnitStatusChanged: () => router.refresh(),
    onNotificationNew: () => router.refresh(),
  });
}
