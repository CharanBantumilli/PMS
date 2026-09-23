import { z } from 'zod';

// ID number validation patterns per ID type
const ID_PATTERNS: Record<string, { regex: RegExp; label: string }> = {
  AADHAR:           { regex: /^\d{4}\s?\d{4}\s?\d{4}$/, label: '12 digits (e.g. 1234 5678 9012)' },
  PASSPORT:         { regex: /^[A-PR-WY][0-9]{7,8}$/i, label: '1 letter + 7-8 digits (e.g. A1234567)' },
  DRIVER_LICENSE:   { regex: /^[A-Z0-9-]{5,20}$/i, label: '5-20 alphanumeric characters' },
  VOTER_ID:         { regex: /^[A-Z]{3}\d{7,8}$/i, label: '3 letters + 7-8 digits (e.g. ABC12345678)' },
  PAN_CARD:         { regex: /^[A-Z]{5}\d{4}[A-Z]$/i, label: '5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)' },
  NATIONAL_ID:      { regex: /^[A-Z0-9-]{4,25}$/i, label: '4-25 alphanumeric characters' },
  SOCIAL_SECURITY:  { regex: /^\d{3}-?\d{2}-?\d{4}$/, label: '9 digits (e.g. 123-45-6789)' },
  MILITARY_ID:      { regex: /^[A-Z0-9]{5,15}$/i, label: '5-15 alphanumeric characters' },
  OTHER:            { regex: /^.{1,50}$/, label: 'Up to 50 characters' },
};

export function validateIdNumber(idType: string | null | undefined, idNumber: string | null | undefined): string | null {
  if (!idType || !idNumber || idNumber.trim() === '') return null;
  const rule = ID_PATTERNS[idType];
  if (!rule) return null; // unknown type, skip validation
  if (!rule.regex.test(idNumber.trim())) {
    return `Invalid ${idType.replace('_', ' ').toLowerCase()} format. Expected: ${rule.label}`;
  }
  return null;
}

// ISO 3166-1 alpha-2 country codes
const ISO2_CODES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO ' +
  'BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ' +
  'ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN ' +
  'IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH ' +
  'MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN ' +
  'PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ ' +
  'TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

// Accepts '' / null as an explicit clear (null); otherwise must be a valid ISO 3166-1 alpha-2 code (normalized uppercase)
export const isoCountryOptional = z
  .preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const t = v.trim();
      return t === '' ? null : t.toUpperCase();
    },
    z.string().refine((v) => ISO2_CODES.has(v), {
      message: 'Must be a valid 2-letter ISO country code',
    }).nullable().optional()
  );

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(80).trim(),
  organizationSlug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only'),
  name: z.string().min(2).max(80).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(120).trim()
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(8).max(120).trim(),
  country: isoCountryOptional,
  currency: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.enum(['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CHF'], {
      message: 'Supported currencies: USD, EUR, GBP, INR, AUD, CAD, SGD, AED, JPY, CHF',
    }).default('USD')
  ),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const propertySchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9-]+$/),
  type: z.enum([
    'HOTEL', 'HOSTEL', 'APARTMENT', 'VILLA', 'RESORT',
    'BED_BREAKFAST', 'VACATION_RENTAL', 'BOUTIQUE',
  ]),
  description: z.string().optional().nullable(),
  starRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: isoCountryOptional,
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)').optional().nullable().or(z.literal('')),
  email: z.string().email().optional().nullable().or(z.literal('')),
  policies: z.string().optional().nullable(),
  amenities: z.array(z.string()).default([]),
});

export const unitTypeSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional().nullable(),
  baseOccupancy: z.coerce.number().int().min(1).max(20).default(2),
  maxOccupancy: z.coerce.number().int().min(1).max(40).default(2),
  extraPersonFee: z.coerce.number().nonnegative().optional().nullable(),
  size: z.coerce.number().positive().optional().nullable(),
  bedType: z.enum(['SINGLE','DOUBLE','QUEEN','KING','TWIN','BUNK','SOFA_BED','NONE']).default('QUEEN'),
  bedCount: z.coerce.number().int().min(0).max(20).default(1),
  bathroomCount: z.coerce.number().int().min(0).max(20).default(1),
  amenities: z.array(z.string()).default([]),
});

export const unitSchema = z.object({
  propertyId: z.string(),
  unitTypeId: z.string().optional().nullable(),
  name: z.string().min(1).max(80),
  number: z.string().min(1).max(20),
  floor: z.string().optional().nullable(),
  status: z.enum([
    'VACANT_CLEAN','VACANT_DIRTY','OCCUPIED_CLEAN','OCCUPIED_DIRTY',
    'INSPECTION','OUT_OF_ORDER','OUT_OF_SERVICE',
  ]).default('VACANT_CLEAN'),
  notes: z.string().optional().nullable(),
});

export const ratePlanSchema = z.object({
  propertyId: z.string().optional().nullable(),
  name: z.string().min(1).max(80),
  description: z.string().optional().nullable(),
  basePrice: z.coerce.number().nonnegative(),
  weekendMultiplier: z.coerce.number().positive().optional().nullable(),
  minStay: z.coerce.number().int().min(1).max(60).default(1),
  maxStay: z.coerce.number().int().min(1).max(365).optional().nullable(),
  isRefundable: z.boolean().default(true),
  mealsIncluded: z.enum(['none','breakfast','half-board','full-board','all-inclusive']).default('none'),
  isActive: z.boolean().default(true),
});

export const guestBaseSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: isoCountryOptional,
  gstin: z.string().max(15).optional().nullable(),
  idType: z.string().max(30).optional().nullable(),
  idNumber: z.string().max(50).optional().nullable(),
  idDocumentUrl: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  vipLevel: z.coerce.number().int().min(0).max(5).default(0),
  marketingOptIn: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const guestSchema = guestBaseSchema.superRefine((data, ctx) => {
  const err = validateIdNumber(data.idType, data.idNumber);
  if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ['idNumber'] });
});

export const bookingBaseSchema = z.object({
  propertyId: z.string(),
  unitId: z.string().optional().nullable(),
  guestId: z.string(),
  ratePlanId: z.string().optional().nullable(),
  arrivalDate: z.string(),
  departureDate: z.string(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  infants: z.coerce.number().int().min(0).max(20).default(0),
  source: z.enum([
    'DIRECT','WALK_IN','PHONE','EMAIL','OTHER',
  ]).default('DIRECT'),
  unitRate: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().default(0),
  taxAmount: z.coerce.number().nonnegative().default(0),
  specialRequests: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  status: z.enum(['PENDING','CONFIRMED']).default('PENDING'),
  guestIdType: z.string().max(30).optional().nullable(),
  guestIdNumber: z.string().max(50).optional().nullable(),
  idDocumentUrl: z.string().optional().nullable(),
});

export const bookingSchema = bookingBaseSchema.superRefine((data, ctx) => {
  const err = validateIdNumber(data.guestIdType, data.guestIdNumber);
  if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ['guestIdNumber'] });
});

export const paymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative(),
  method: z.enum(['CASH','CARD','UPI','NETBANKING','BANK_TRANSFER','CHEQUE','RAZORPAY','PAYPAL','STRIPE','OTHER']),
  status: z.enum(['PENDING','PAID','PARTIAL','REFUNDED','FAILED']).default('PAID'),
  reference: z.string().optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const expenseSchema = z.object({
  category: z.enum([
    'UTILITIES','SUPPLIES','MAINTENANCE','SALARY','MARKETING','TAX','INSURANCE','FOOD_BEVERAGE','OTHER',
  ]),
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  vendor: z.string().optional().nullable(),
  expenseDate: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

export const housekeepingTaskSchema = z.object({
  propertyId: z.string(),
  unitId: z.string(),
  bookingId: z.string().optional().nullable(),
  type: z.enum(['FULL_CLEAN','TOUCH_UP','TURNDOWN','INSPECTION','LINEN_CHANGE','RESTOCK']).default('FULL_CLEAN'),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  assigneeId: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const maintenanceSchema = z.object({
  unitId: z.string(),
  bookingId: z.string().optional().nullable(),
  title: z.string().min(1).max(160),
  description: z.string().min(1),
  priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'),
  category: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  estimatedCost: z.coerce.number().nonnegative().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER','ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPER','ACCOUNTANT']),
  permissions: z.array(z.string()).nullable().optional(),
});
