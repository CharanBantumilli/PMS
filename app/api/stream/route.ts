// Server-Sent Events (SSE) endpoint for real-time updates
// Clients connect to /api/stream and receive push events when data changes

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return new Response('Unauthorized', { status: 401 });
  }
  const orgId = session.user.organizationId;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (event: string, data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial heartbeat
      send('connected', { orgId, timestamp: Date.now() });

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => send('ping', { ts: Date.now() }), 15000);

      // Poll for changes every 5s (lightweight real-time for shared workspaces)
      let lastBookingCount = 0;
      let lastNotificationCount = 0;
      let lastUnitStates: Map<string, string> = new Map();

      // Initialize unit states
      prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, status: true } }).then((units) => {
        for (const u of units) lastUnitStates.set(u.id, u.status);
      }).catch(() => {});

      const poll = setInterval(async () => {
        if (closed) return;
        try {
          // Check for new bookings
          const bookingCount = await prisma.booking.count({ where: { organizationId: orgId } });
          if (bookingCount > lastBookingCount) {
            const newBookings = await prisma.booking.findMany({
              where: { organizationId: orgId },
              orderBy: { createdAt: 'desc' },
              take: bookingCount - lastBookingCount,
              include: { guest: true, property: true },
            });
            send('booking.created', { count: bookingCount - lastBookingCount, bookings: newBookings.map((b) => ({ id: b.id, code: b.confirmationCode, guest: `${b.guest.firstName} ${b.guest.lastName}`, property: b.property.name, createdAt: b.createdAt })) });
            lastBookingCount = bookingCount;
          }

          // Check for new notifications
          const notifCount = await prisma.notification.count({ where: { organizationId: orgId, userId: session.user.id } });
          if (notifCount > lastNotificationCount) {
            send('notification.new', { count: notifCount - lastNotificationCount });
            lastNotificationCount = notifCount;
          }

          // Check for unit status changes (housekeeping/maintenance)
          const units = await prisma.unit.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, status: true, number: true } });
          for (const u of units) {
            const prev = lastUnitStates.get(u.id);
            if (prev && prev !== u.status) {
              send('unit.statusChanged', { unitId: u.id, number: u.number, from: prev, to: u.status });
            }
            lastUnitStates.set(u.id, u.status);
          }
        } catch {}
      }, 5000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeat);
        clearInterval(poll);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
