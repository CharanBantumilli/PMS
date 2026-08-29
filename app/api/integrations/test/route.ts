import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { testIntegration, validateConfig, INTEGRATION_DEFS } from '@/lib/integrations';

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || '');
  if (!type) return jsonError('type is required', 400);
  if (!(type in INTEGRATION_DEFS) && type !== 'CUSTOM_WEBHOOK') return jsonError('Unknown integration type', 400);

  const integration = await prisma.integrationConfig.findUnique({
    where: { organizationId_type: { organizationId: ctx.organizationId, type: type as any } },
  });
  if (!integration) return jsonError('Integration not configured yet — save your settings first', 404);

  const config = integration.config as Record<string, unknown>;
  const validation = validateConfig(type, config);
  if (!validation.ok) {
    await prisma.integrationConfig.update({ where: { id: integration.id }, data: { errorMessage: validation.error! } });
    return jsonOk({ ok: false, message: `Incomplete configuration — ${validation.error}` });
  }

  const result = await testIntegration(type, config);
  await prisma.integrationConfig.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), errorMessage: result.ok ? null : result.message },
  });
  await logActivity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'UPDATE',
    entity: 'Integration',
    entityId: integration.id,
    description: `${result.ok ? 'Tested' : 'Test failed'} ${integration.type}: ${result.message}`,
  });
  return jsonOk(result);
}
