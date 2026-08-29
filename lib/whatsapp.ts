// WhatsApp Business Cloud API integration via Meta Graph API
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

import { prisma } from './prisma';

const META_API_VERSION = 'v19.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type WhatsAppMessage = {
  to: string; // E.164 phone number, e.g. +919876543210
  type: 'template' | 'text';
  template?: {
    name: string;
    language: { code: string }; // e.g. 'en' or 'en_IN'
    components?: { type: string; parameters: { type: string; text?: string }[] }[];
  };
  text?: { body: string };
};

export type WhatsAppSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
};

export async function sendWhatsAppMessage(config: {
  phoneNumberId: string;
  accessToken: string;
  message: WhatsAppMessage;
}): Promise<WhatsAppSendResult> {
  const url = `${META_API_BASE}/${config.phoneNumberId}/messages`;
  try {
    const body: any = {
      messaging_product: 'whatsapp',
      to: config.message.to,
      type: config.message.type,
    };
    if (config.message.type === 'template' && config.message.template) {
      body.template = config.message.template;
    } else if (config.message.type === 'text' && config.message.text) {
      body.text = config.message.text;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      return { ok: true, messageId: data?.messages?.[0]?.id, raw: data };
    }
    return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, raw: data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

/**
 * Send a WhatsApp message using the organization's stored WhatsApp config.
 * Returns null if WhatsApp is not configured.
 */
export async function sendWhatsAppViaOrgConfig(opts: {
  organizationId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  variables?: string[]; // for {{1}}, {{2}}, etc.
}): Promise<WhatsAppSendResult | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { organizationId_type: { organizationId: opts.organizationId, type: 'WHATSAPP' } },
  });
  if (!config || !config.isEnabled) return null;

  const cfg = config.config as Record<string, any>;
  const phoneNumberId = cfg.phoneNumberId as string;
  const accessToken = cfg.accessToken as string;
  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WhatsApp not fully configured (missing phoneNumberId or accessToken)' };
  }

  // Build template components
  const components: any[] = [];
  if (opts.variables && opts.variables.length > 0) {
    components.push({
      type: 'body',
      parameters: opts.variables.map((v) => ({ type: 'text', text: v })),
    });
  }

  return sendWhatsAppMessage({
    phoneNumberId,
    accessToken,
    message: {
      to: opts.to,
      type: 'template',
      template: {
        name: opts.templateName,
        language: { code: opts.languageCode || 'en' },
        components: components.length > 0 ? components : undefined,
      },
    },
  });
}

/**
 * Pre-built message templates for common PMS notifications.
 * These are template names that the user must have approved in Meta Business Suite.
 */
export const WHATSAPP_TEMPLATES = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  CHECK_IN_REMINDER: 'checkin_reminder',
  CHECK_OUT_REMINDER: 'checkout_reminder',
  PAYMENT_RECEIVED: 'payment_received',
  INVOICE_SENT: 'invoice_sent',
  REVIEW_REQUEST: 'review_request',
} as const;
