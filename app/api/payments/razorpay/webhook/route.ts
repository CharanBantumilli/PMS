import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/api';
import crypto from 'crypto';

// Razorpay sends payment events here. Verify signature, then record the payment.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  // Find org by parsing the order notes or use a default
  // For now, iterate all orgs with Razorpay configured
  const configs = await prisma.integrationConfig.findMany({
    where: { type: 'RAZORPAY', isEnabled: true },
  });

  let matchedConfig: any = null;
  for (const cfg of configs) {
    const webhookSecret = (cfg.config as any)?.webhookSecret;
    if (!webhookSecret) continue;
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) { matchedConfig = cfg; break; }
    } catch {}
  }

  if (!matchedConfig) {
    return NextResponse.json({ error: 'No matching webhook secret' }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const orgId = matchedConfig.organizationId;

  if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
    const payment = event.payload?.payment?.entity;
    if (!payment) return NextResponse.json({ ok: true });

    // Idempotency: skip if this payment was already recorded
    const existingPayment = await prisma.payment.findFirst({
      where: { organizationId: orgId, reference: payment.id },
    });
    if (existingPayment) return NextResponse.json({ ok: true, message: 'Already processed' });

    const invoiceId = payment.notes?.invoiceId;
    if (!invoiceId) return NextResponse.json({ ok: true });

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
    });
    if (!invoice) return NextResponse.json({ ok: true });

    const amountInRupees = payment.amount / 100;

    // Create payment record
    await prisma.payment.create({
      data: {
        organizationId: orgId,
        invoiceId,
        bookingId: invoice.bookingId,
        amount: amountInRupees,
        currency: payment.currency?.toUpperCase() || 'INR',
        method: 'RAZORPAY',
        status: 'PAID',
        paidAt: new Date(payment.created_at * 1000),
        reference: payment.id,
        notes: `Razorpay ${payment.method || 'online'} — ${payment.description || ''}`,
      },
    });

    // Update invoice
    const newPaidAmount = Number(invoice.paidAmount) + amountInRupees;
    const newBalance = Math.max(0, Number(invoice.total) - newPaidAmount);
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaidAmount, balance: newBalance, status: newStatus },
    });

    await logActivity({
      organizationId: orgId, userId: null, action: 'PAYMENT_RECEIVED', entity: 'Payment',
      entityId: invoiceId, description: `Razorpay payment ₹${amountInRupees} for ${invoice.invoiceNumber}`,
    });
  }

  return NextResponse.json({ ok: true });
}
