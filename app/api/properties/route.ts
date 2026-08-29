import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { propertySchema } from '@/lib/validators';

export async function GET() {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const properties = await prisma.property.findMany({
    where: { organizationId: ctx.organizationId },
    include: { _count: { select: { units: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk(properties);
}

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER'])) return jsonError('Forbidden', 403);
  const body = await req.json();
  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  const data = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  if (!org) return jsonError('Organization not found', 404);
  const count = await prisma.property.count({ where: { organizationId: ctx.organizationId } });
  if (count >= org.maxProperties) return jsonError(`Your plan allows up to ${org.maxProperties} properties.`, 402);

  const existing = await prisma.property.findUnique({ where: { organizationId_code: { organizationId: ctx.organizationId, code: data.code } } });
  if (existing) return jsonError('A property with this code already exists.', 409);

  const property = await prisma.property.create({
    data: {
      name: data.name,
      code: data.code,
      type: data.type,
      description: data.description ?? null,
      starRating: data.starRating ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country ?? null,
      phone: data.phone ?? null,
      email: data.email || null,
      policies: data.policies ?? null,
      amenities: data.amenities ?? [],
      organizationId: ctx.organizationId,
    },
  });
  await logActivity({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'CREATE', entity: 'Property', entityId: property.id, description: `Created property ${property.name}` });
  return jsonOk(property, 201);
}
