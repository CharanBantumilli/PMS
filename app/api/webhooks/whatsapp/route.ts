import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// WhatsApp Cloud API webhook receiver
// Receives delivery status updates and inbound messages
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

export async function GET(req: NextRequest) {
  // Webhook verification (GET request with hub.mode, hub.verify_token, hub.challenge)
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe') {
    // Look up any WhatsApp config in any org that matches the verify token
    const configs = await prisma.integrationConfig.findMany({ where: { type: 'WHATSAPP' } });
    for (const c of configs) {
      const cfg = c.config as Record<string, any>;
      if (cfg.verifyToken && cfg.verifyToken === token) {
        return new NextResponse(challenge, { status: 200 });
      }
    }
    return new NextResponse('Forbidden', { status: 403 });
  }
  return new NextResponse('OK', { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Process WhatsApp events
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;
          // Status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              // Log delivery status (in production, update message log table)
              console.log(`WhatsApp message ${status.id} status: ${status.status} to ${status.recipient_id}`);
            }
          }
          // Inbound messages
          if (value.messages) {
            for (const msg of value.messages) {
              console.log(`WhatsApp inbound from ${msg.from}: ${msg.text?.body || msg.type}`);
              // In production, auto-reply or create a note/conversation
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 200 }); // Always 200 to prevent retries
  }
}
