'use client';

import { useEffect, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { useRealtimeEvents } from '@/lib/use-realtime';
import { useRouter } from 'next/navigation';

export function DashboardLive() {
  const router = useRouter();
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { connected } = useRealtimeEvents({
    onBookingCreated: (data) => {
      setLastEvent(`+${data.count} new booking${data.count > 1 ? 's' : ''}`);
      setLastUpdate(new Date());
      router.refresh();
    },
    onUnitStatusChanged: (data) => {
      setLastEvent(`Unit #${data.number} → ${data.to.replace(/_/g, ' ').toLowerCase()}`);
      setLastUpdate(new Date());
      router.refresh();
    },
    onNotificationNew: () => {
      setLastEvent('New notification');
      setLastUpdate(new Date());
      router.refresh();
    },
  });

  return (
    <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Radio className={`h-3.5 w-3.5 ${connected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
        <span className={connected ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
          {connected ? 'Live' : 'Offline'}
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">
          {lastEvent ? `Last: ${lastEvent}` : 'Real-time updates enabled'}
        </span>
      </div>
      {lastUpdate && (
        <span className="text-slate-400">
          <RefreshCw className="inline h-3 w-3" /> {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
