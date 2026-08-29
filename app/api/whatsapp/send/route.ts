import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';
import { sendWhatsAppViaOrgConfig, WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const { bookingId, template, variables, customMessage } = body;
  if (!bookingId) return jsonError('bookingId is required', 400);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, organizationId: ctx.organizationId },
    include: { guest: true, property: true, unit: true },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (!booking.guest.phone) return jsonError('Guest has no phone number on file', 400);

  // Send freeform text message
  if (customMessage) {
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp');
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId_type: { organizationId: ctx.organizationId, type: 'WHATSAPP' } },
    });
    if (!config || !config.isEnabled) return jsonError('WhatsApp is not configured', 400);
    const cfg = config.config as Record<string, any>;
    const result = await sendWhatsAppMessage({
      phoneNumberId: cfg.phoneNumberId,
      accessToken: cfg.accessToken,
      message: { to: booking.guest.phone, type: 'text', text: { body: customMessage } },
    });
    if (!result.ok) return jsonError(result.error || 'Failed to send', 502);
    return jsonOk({ ok: true, messageId: result.messageId });
  }

  // Send template message
  if (template) {
    const validTemplates = Object.values(WHATSAPP_TEMPLATES);
    if (!validTemplates.includes(template)) return jsonError('Invalid template', 400);
    const result = await sendWhatsAppViaOrgConfig({
      organizationId: ctx.organizationId,
      to: booking.guest.phone,
      templateName: template,
      variables: variables || [],
    });
    if (!result) return jsonError('WhatsApp is not configured', 400);
    if (!result.ok) return jsonError(result.error || 'Failed to send', 502);
    return jsonOk({ ok: true, messageId: result.messageId });
  }

  return jsonError('Either template or customMessage is required', 400);
}
