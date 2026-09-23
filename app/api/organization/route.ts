import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { isoCountryOptional } from '@/lib/validators';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  sacCode: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: isoCountryOptional,
  // Workspace currency is fixed to INR at launch
  currency: z.literal('INR', { message: 'This workspace runs on INR (Indian Rupee) only.' }).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  brandName: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
});

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!org) return jsonError('Not found', 404);
  return jsonOk(org);
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const org = await prisma.organization.update({ where: { id: ctx.organizationId }, data: parsed.data });
  await logActivity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'UPDATE',
    entity: 'Organization',
    entityId: org.id,
    description: 'Updated organization details',
  });
  return jsonOk(org);
}
