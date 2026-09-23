import { prisma } from '@/lib/prisma';

export type RateQuote = {
  ratePlanId: string | null;
  unitRate: number;
  subtotal: number;
  nights: number;
  weekendSurcharge: number;
  seasonalOverride: boolean;
  extraPersonCharge: number;
  restrictions: string[];
  currency: string;
};

/**
 * Calculate the rate for a booking based on rate plans, seasonal overrides,
 * weekend multipliers, and LOS restrictions.
 *
 * If no ratePlanId is provided, returns a zero quote.
 */
export async function calculateRate(opts: {
  organizationId: string;
  propertyId: string;
  ratePlanId?: string | null;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  unitTypeId?: string | null;
}): Promise<RateQuote> {
  const { organizationId, propertyId, ratePlanId, arrivalDate, departureDate, adults, children, unitTypeId } = opts;

  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  // Strip time components for date-only comparison (avoids DST issues)
  const aDate = new Date(arrival.getFullYear(), arrival.getMonth(), arrival.getDate());
  const dDate = new Date(departure.getFullYear(), departure.getMonth(), departure.getDate());
  const nights = Math.max(1, Math.round((dDate.getTime() - aDate.getTime()) / 86400000));

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { currency: true } });
  const currency = org?.currency || 'INR';

  // Find the rate plan
  let ratePlan: Awaited<ReturnType<typeof prisma.ratePlan.findFirst>> = null;
  if (ratePlanId) {
    ratePlan = await prisma.ratePlan.findFirst({
      where: { id: ratePlanId, organizationId, isActive: true },
    });
  } else {
    // Fall back to the first active rate plan for this property (or org-wide)
    ratePlan = await prisma.ratePlan.findFirst({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { propertyId },
          { propertyId: null },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!ratePlan) {
    return {
      ratePlanId: null,
      unitRate: 0,
      subtotal: 0,
      nights,
      weekendSurcharge: 0,
      seasonalOverride: false,
      extraPersonCharge: 0,
      restrictions: [],
      currency,
    };
  }

  let unitRate = Number(ratePlan.basePrice);
  let weekendSurcharge = 0;
  let seasonalOverride = false;

  // Check for seasonal rate overrides (highest priority wins)
  const seasonalRates = await prisma.seasonalRate.findMany({
    where: {
      organizationId,
      ratePlanId: ratePlan.id,
      isActive: true,
      OR: [
        { propertyId },
        { propertyId: null },
      ],
      startDate: { lte: departure },
      endDate: { gte: arrival },
    },
    orderBy: { priority: 'desc' },
  });

  if (seasonalRates.length > 0) {
    // Use the highest priority seasonal rate
    unitRate = Number(seasonalRates[0]!.price);
    seasonalOverride = true;
  }

  // Apply weekend multiplier (additive with seasonal rates)
  if (ratePlan.weekendMultiplier && Number(ratePlan.weekendMultiplier) > 0) {
    const weekendMultiplier = Number(ratePlan.weekendMultiplier);
    let weekendNights = 0;
    const cursor = new Date(arrival);
    for (let i = 0; i < nights; i++) {
      const dayOfWeek = cursor.getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        weekendNights++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (weekendNights > 0) {
      const weekdayNights = nights - weekendNights;
      const weekdayRate = unitRate;
      const weekendRate = unitRate * weekendMultiplier;
      unitRate = (weekdayRate * weekdayNights + weekendRate * weekendNights) / nights;
      weekendSurcharge = (weekendRate - weekdayRate) * weekendNights;
    }
  }

  // Check rate restrictions
  const restrictions: string[] = [];
  const rateRestrictions = await prisma.rateRestriction.findMany({
    where: {
      organizationId,
      isActive: true,
      AND: [
        { OR: [{ ratePlanId: ratePlan.id }, { ratePlanId: null }] },
        { OR: [{ propertyId }, { propertyId: null }] },
      ],
      startDate: { lte: departure },
      endDate: { gte: arrival },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const advanceDays = Math.round((arrival.getTime() - today.getTime()) / 86400000);

  for (const r of rateRestrictions) {
    // If daysOfWeek is specified, only apply restriction if arrival day matches
    if (r.daysOfWeek && r.daysOfWeek.length > 0) {
      const arrivalDayOfWeek = aDate.getDay();
      if (!r.daysOfWeek.includes(arrivalDayOfWeek)) continue;
    }
    // MIN_LOS
    if (r.restrictionType === 'MIN_LOS' && r.minLOS && nights < r.minLOS) {
      restrictions.push(`Minimum stay is ${r.minLOS} nights`);
    }
    // MAX_LOS
    if (r.restrictionType === 'MAX_LOS' && r.maxLOS && nights > r.maxLOS) {
      restrictions.push(`Maximum stay is ${r.maxLOS} nights`);
    }
    // CLOSED_TO_ARRIVAL
    if (r.restrictionType === 'CLOSED_TO_ARRIVAL' && r.closedToArrival) {
      restrictions.push('Closed to arrival on selected dates');
    }
    // CLOSED_TO_DEPARTURE
    if (r.restrictionType === 'CLOSED_TO_DEPARTURE' && r.closedToDeparture) {
      restrictions.push('Closed to departure on selected dates');
    }
    // MIN_ADVANCE
    if (r.restrictionType === 'MIN_ADVANCE' && r.minAdvance && advanceDays < r.minAdvance) {
      restrictions.push(`Must book at least ${r.minAdvance} days in advance`);
    }
    // MAX_ADVANCE
    if (r.restrictionType === 'MAX_ADVANCE' && r.maxAdvance && advanceDays > r.maxAdvance) {
      restrictions.push(`Cannot book more than ${r.maxAdvance} days in advance`);
    }
  }

  // Enforce min/max stay from rate plan
  if (ratePlan.minStay && nights < ratePlan.minStay) {
    restrictions.push(`Minimum stay for this rate plan is ${ratePlan.minStay} nights`);
  }
  if (ratePlan.maxStay && nights > ratePlan.maxStay) {
    restrictions.push(`Maximum stay for this rate plan is ${ratePlan.maxStay} nights`);
  }

  // Extra person fee: charge for guests exceeding the unit type's base occupancy
  let extraPersonCharge = 0;
  if (unitTypeId) {
    const unitType = await prisma.unitTypeDefinition.findFirst({
      where: { id: unitTypeId, organizationId },
    });
    if (unitType && unitType.extraPersonFee) {
      const totalGuests = adults + children;
      const baseOccupancy = unitType.baseOccupancy || 2;
      if (totalGuests > baseOccupancy) {
        const extraPersons = totalGuests - baseOccupancy;
        extraPersonCharge = extraPersons * Number(unitType.extraPersonFee) * nights;
      }
    }
  }

  const subtotal = Math.round((unitRate * nights + extraPersonCharge) * 100) / 100;

  return {
    ratePlanId: ratePlan.id,
    unitRate: Math.round(unitRate * 100) / 100,
    subtotal,
    nights,
    weekendSurcharge: Math.round(weekendSurcharge * 100) / 100,
    seasonalOverride,
    extraPersonCharge: Math.round(extraPersonCharge * 100) / 100,
    restrictions,
    currency,
  };
}
