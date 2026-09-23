import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';

export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','ACCOUNTANT'])) return jsonError('Forbidden', 403);

  const body = await req.json();
  const { invoiceId, amount, currency = 'INR', customerEmail, customerName, receipt } = body;

  if (!invoiceId || !amount) return jsonError('invoiceId and amount required', 400);

  // Get Razorpay config
  const razorpayConfig = await prisma.integrationConfig.findUnique({
    where: { organizationId_type: { organizationId: ctx.organizationId, type: 'RAZORPAY' } },
  });
  if (!razorpayConfig || !razorpayConfig.isEnabled) {
    return jsonError('Razorpay not configured. Go to Integrations to set it up.', 400);
  }

  const config = razorpayConfig.config as any;
  if (!config.keyId || !config.keySecret) {
    return jsonError('Razorpay keys incomplete', 400);
  }

  // Verify invoice exists and belongs to this org
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
  });
  if (!invoice) return jsonError('Invoice not found', 404);

  // Create Razorpay order
  try {
    const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
    const amountInPaise = Math.round(Number(amount) * 100);

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt || invoice.invoiceNumber,
        notes: { invoiceId, invoiceNumber: invoice.invoiceNumber, organizationId: ctx.organizationId },
      }),
    });

    const order = await res.json();
    if (!res.ok) {
      return jsonError(order.error?.description || `Razorpay error: ${res.status}`, 400);
    }

    return jsonOk({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.keyId,
      customerEmail,
      customerName,
      invoiceNumber: invoice.invoiceNumber,
    });
  } catch (e: any) {
    return jsonError('Payment gateway error', 500);
  }
}
