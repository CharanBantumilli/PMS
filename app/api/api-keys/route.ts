import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import crypto from 'crypto';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const keys = await prisma.apiKey.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' } });
  // Never return the full key
  return jsonOk(keys.map((k) => ({ ...k, key: undefined })));
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const name = (body.name || '').toString().trim();
  if (!name) return jsonError('Name is required', 400);
  const raw = `pms_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = raw.slice(0, 14);
  const key = await prisma.apiKey.create({
    data: { organizationId: ctx.organizationId, name, key: raw, prefix, scopes: [], createdById: ctx.userId, isActive: true },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'ApiKey', entityId: key.id, description: `Created API key ${name}` });
  // Return the full key only this once
  return jsonOk({ ...key }, 201);
}
