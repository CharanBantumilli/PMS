import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { INTEGRATION_DEFS, maskConfig, mergeConfig, validateConfig } from '@/lib/integrations';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(80),
  isEnabled: z.boolean().optional(),
  type: z.enum(['STRIPE','SMTP','TWILIO','WHATSAPP','QUICKBOOKS','XERO','SLACK','ZAPIER','CUSTOM_WEBHOOK']).optional(),
  config: z.record(z.any()).optional(),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const integrations = await prisma.integrationConfig.findMany({ where: { organizationId: ctx.organizationId } });
  // Secrets never leave the server unmasked
  return jsonOk(integrations.map((i) => ({ ...i, config: maskConfig(i.config as Record<string, unknown>) })));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const d = parsed.data;
  const type = d.type || 'CUSTOM_WEBHOOK';
  if (type !== 'CUSTOM_WEBHOOK' && !INTEGRATION_DEFS[type]) return jsonError('Unknown integration type', 400);

  const existing = await prisma.integrationConfig.findUnique({
    where: { organizationId_type: { organizationId: ctx.organizationId, type } },
  });

  // Merge incoming values into stored ones so masked secrets are preserved
  const merged = d.config ? mergeConfig(d.config, existing?.config as Record<string, unknown> | null) : existing?.config || {};
  const validation = validateConfig(type, merged as Record<string, unknown>);
  if (!validation.ok && (d.isEnabled ?? true)) {
    return jsonError(`Cannot enable — ${validation.error}`, 400);
  }

  const i = await prisma.integrationConfig.upsert({
    where: { organizationId_type: { organizationId: ctx.organizationId, type } },
    update: { isEnabled: d.isEnabled ?? true, name: d.name, config: merged as any },
    create: { organizationId: ctx.organizationId, type, name: d.name, isEnabled: d.isEnabled ?? true, config: merged as any },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'UPDATE', entity: 'Integration', entityId: i.id, description: `${d.isEnabled ? 'Enabled' : 'Saved'} ${i.type} (${i.name})` });
  return jsonOk({ ...i, config: maskConfig(i.config as Record<string, unknown>) });
}
