import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import crypto from 'crypto';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const webhooks = await prisma.webhook.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' } });
  return jsonOk(webhooks.map((w) => ({ ...w, secret: undefined })));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const secret = crypto.randomBytes(32).toString('hex');
  const w = await prisma.webhook.create({
    data: { organizationId: ctx.organizationId, name: parsed.data.name, url: parsed.data.url, secret, events: parsed.data.events, isActive: parsed.data.isActive ?? true, createdById: ctx.userId },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Webhook', entityId: w.id, description: `Created webhook ${w.name}` });
  return jsonOk({ ...w, secret }, 201);
}
