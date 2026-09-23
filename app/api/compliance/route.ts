import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';

// DPDPA: Export all guest data (Right to data portability)
export async function GET(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Only admins can export PII data', 403);

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const guestId = searchParams.get('guestId');

  if (!email && !guestId) return jsonError('Provide email or guestId', 400);

  let guest;
  if (guestId) {
    guest = await prisma.guest.findFirst({ where: { id: guestId, organizationId: ctx.organizationId } });
  } else {
    guest = await prisma.guest.findFirst({ where: { email, organizationId: ctx.organizationId } });
  }
  if (!guest) return jsonError('Guest not found', 404);

  // Export all guest data
  const bookings = await prisma.booking.findMany({
    where: { guestId: guest.id, organizationId: ctx.organizationId },
    include: { property: true, unit: true, ratePlan: true, invoice: true, payments: true },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    organization: ctx.organizationId,
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      address: guest.address,
      city: guest.city,
      state: guest.state,
      postalCode: guest.postalCode,
      country: guest.country,
      gstin: guest.gstin,
      dateOfBirth: guest.dateOfBirth,
      nationality: guest.nationality,
      idType: guest.idType,
      idNumber: guest.idNumber,
      totalStays: guest.totalStays,
      totalSpent: Number(guest.totalSpent),
      createdAt: guest.createdAt,
    },
    bookings: bookings.map((b: any) => ({
      id: b.id,
      confirmationCode: b.confirmationCode,
      property: b.property?.name,
      unit: b.unit?.number,
      ratePlan: b.ratePlan?.name,
      arrivalDate: b.arrivalDate,
      departureDate: b.departureDate,
      status: b.status,
      totalAmount: Number(b.totalAmount),
      invoices: (b.invoice ? [b.invoice] : []).map((i: any) => ({
        invoiceNumber: i.invoiceNumber,
        total: Number(i.total),
        paidAmount: Number(i.paidAmount),
        status: i.status,
      })),
      payments: b.payments.map((p) => ({
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
      })),
    })),
  };

  await logActivity({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'UPDATE', entity: 'Guest', entityId: guest.id,
    description: `DPDPA data export for ${guest.email || guest.firstName}`,
  });

  return jsonOk(exportData);
}

// DPDPA: Delete all guest data (Right to erasure / Right to be forgotten)
export async function DELETE(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN'])) return jsonError('Only Owner/Admin can erase data', 403);

  const body = await req.json();
  const { guestId, email, confirm } = body;
  if (confirm !== 'ERASE_ALL_DATA') return jsonError('Send confirm: "ERASE_ALL_DATA" to proceed', 400);

  let guest;
  if (guestId) {
    guest = await prisma.guest.findFirst({ where: { id: guestId, organizationId: ctx.organizationId } });
  } else if (email) {
    guest = await prisma.guest.findFirst({ where: { email, organizationId: ctx.organizationId } });
  }
  if (!guest) return jsonError('Guest not found', 404);

  // Anonymize guest data (don't hard delete to preserve booking/invoice integrity)
  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      firstName: 'DELETED',
      lastName: 'USER',
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      gstin: null,
      idType: null,
      idNumber: null,
      idDocumentUrl: null,
      dateOfBirth: null,
      nationality: null,
      notes: null,
      marketingOptIn: false,
      vipLevel: 0,
    },
  });

  await logActivity({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'DELETE', entity: 'Guest', entityId: guest.id,
    description: `DPDPA data erasure for guest ${guest.id}`,
  });

  return jsonOk({ ok: true, message: 'Guest data erased per DPDPA Right to Erasure' });
}
