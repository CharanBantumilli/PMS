import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const webhook = await prisma.webhook.findFirst({ where: { id: params.id, organizationId: ctx.organizationId } });
  if (!webhook) return jsonError('Not found', 404);

  const start = Date.now();
  let responseStatus = 0;
  let errorMessage: string | null = null;
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': 'test.ping', 'X-Webhook-Signature': 'test' },
      body: JSON.stringify({ event: 'test.ping', timestamp: new Date().toISOString(), data: { message: 'This is a test webhook delivery' } }),
      signal: AbortSignal.timeout(10000),
    });
    responseStatus = res.status;
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (e: any) {
    errorMessage = e?.message || 'Request failed';
  }
  const duration = Date.now() - start;
  const status = responseStatus >= 200 && responseStatus < 300 ? 'SUCCESS' : 'FAILED';

  const delivery = await prisma.webhookDelivery.create({
    data: {
      organizationId: ctx.organizationId,
      webhookId: webhook.id,
      event: 'test.ping',
      payload: { test: true },
      response: responseStatus,
      status,
      attempt: 1,
      duration,
      errorMessage,
    },
  });
  return jsonOk({ ok: status === 'SUCCESS', delivery });
}
