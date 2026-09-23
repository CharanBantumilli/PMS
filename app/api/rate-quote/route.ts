import { NextRequest } from 'next/server';
import { apiContext, jsonError, jsonOk } from '@/lib/api';
import { calculateRate } from '@/lib/rate-engine';
import { z } from 'zod';

const schema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  ratePlanId: z.string().optional().nullable(),
  arrivalDate: z.string().min(1, 'Arrival date is required'),
  departureDate: z.string().min(1, 'Departure date is required'),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  unitTypeId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400);

  const quote = await calculateRate({
    organizationId: ctx.organizationId,
    propertyId: parsed.data.propertyId!,
    ratePlanId: parsed.data.ratePlanId,
    arrivalDate: parsed.data.arrivalDate!,
    departureDate: parsed.data.departureDate!,
    adults: parsed.data.adults ?? 1,
    children: parsed.data.children ?? 0,
    unitTypeId: parsed.data.unitTypeId,
  });

  return jsonOk(quote);
}
