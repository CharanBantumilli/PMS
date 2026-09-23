import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.organizationId) return new Response('Unauthorized', { status: 401 });
  const orgId = session.user.organizationId;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { booking: { include: { guest: true, property: true, unit: true } }, items: true },
  });
  if (!invoice) return new Response('Not found', { status: 404 });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const gstin = org?.gstin || org?.taxId || null;
  const legalName = org?.legalName || org?.name;
  const sacCode = invoice.sacCode || org?.sacCode || '9961';
  const cgst = Number(invoice.cgstAmount);
  const sgst = Number(invoice.sgstAmount);
  const igst = Number(invoice.igstAmount);
  const gstRate = Number(invoice.gstRate);
  const hasGstSplit = cgst > 0 || sgst > 0;

  const itemRows = invoice.items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(it.description)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right">${Number(it.quantity)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right">${formatCurrency(Number(it.unitPrice), invoice.currency)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:500">${formatCurrency(Number(it.quantity) * Number(it.unitPrice), invoice.currency)}</td>
    </tr>
  `).join('');

  let taxRows = '';
  if (hasGstSplit) {
    taxRows = `
      <tr><td style="padding:4px 0">CGST @ ${(gstRate / 2).toFixed(1)}%</td><td style="padding:4px 0;text-align:right">${formatCurrency(cgst, invoice.currency)}</td></tr>
      <tr><td style="padding:4px 0">SGST @ ${(gstRate / 2).toFixed(1)}%</td><td style="padding:4px 0;text-align:right">${formatCurrency(sgst, invoice.currency)}</td></tr>
    `;
  } else if (igst > 0) {
    taxRows = `<tr><td style="padding:4px 0">IGST @ ${gstRate}%</td><td style="padding:4px 0;text-align:right">${formatCurrency(igst, invoice.currency)}</td></tr>`;
  } else {
    taxRows = `<tr><td style="padding:4px 0">Tax</td><td style="padding:4px 0;text-align:right">${formatCurrency(Number(invoice.taxAmount), invoice.currency)}</td></tr>`;
  }

  const guestName = invoice.booking ? `${invoice.booking.guest.firstName} ${invoice.booking.guest.lastName}` : '—';
  const guestEmail = invoice.booking?.guest?.email || '';
  const guestPhone = invoice.booking?.guest?.phone || '';
  const guestGstin = (invoice.booking?.guest as any)?.gstin || '';
  const guestState = (invoice.booking?.guest as any)?.state || '';
  const policies = (invoice.booking?.property as any)?.policies || '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 40px; font-size: 14px; }
    @media print { body { padding: 20px; } @page { margin: 15mm; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
    .title { font-size: 24px; font-weight: 700; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .company-name { font-weight: 600; font-size: 15px; }
    .detail { font-size: 13px; color: #475569; line-height: 1.6; }
    .gstin { font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; padding: 8px 0; border-bottom: 2px solid #e2e8f0; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-top: 24px; }
    .totals table { width: 280px; }
    .totals td { padding: 4px 0; font-size: 13px; }
    .totals .total-row td { border-top: 2px solid #0f172a; padding-top: 8px; font-weight: 700; font-size: 16px; }
    .totals .paid td { color: #059669; }
    .totals .balance td { color: #dc2626; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Tax Invoice</div>
      <div class="subtitle">Invoice No: ${invoice.invoiceNumber}</div>
      <div class="subtitle">Date: ${formatDate(invoice.issueDate)} &nbsp;|&nbsp; Due: ${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="section-label">Supplier Details</div>
      <div class="company-name">${escapeHtml(legalName)}</div>
      ${gstin ? `<div class="detail gstin">GSTIN: ${escapeHtml(gstin)}</div>` : ''}
      <div class="detail">
        ${escapeHtml([org?.addressLine1, org?.addressLine2].filter(Boolean).join(', '))}<br>
        ${escapeHtml([org?.city, org?.state, org?.postalCode].filter(Boolean).join(', '))} ${escapeHtml(org?.country || '')}
        ${org?.phone ? `<br>${escapeHtml(org.phone)}` : ''}
        ${org?.email ? `<br>${escapeHtml(org.email)}` : ''}
      </div>
      <div class="detail" style="margin-top:4px;font-size:12px;color:#64748b">SAC: ${escapeHtml(sacCode)}</div>
    </div>
    <div>
      <div class="section-label">Bill To</div>
      <div class="company-name">${escapeHtml(guestName)}</div>
      ${guestEmail ? `<div class="detail">${escapeHtml(guestEmail)}</div>` : ''}
      ${guestPhone ? `<div class="detail">${escapeHtml(guestPhone)}</div>` : ''}
      ${guestGstin ? `<div class="detail gstin">GSTIN: ${escapeHtml(guestGstin)}</div>` : ''}
      ${guestState ? `<div class="detail">State: ${escapeHtml(guestState)}</div>` : ''}
      ${invoice.booking ? `<div class="detail" style="margin-top:4px;font-size:12px;color:#64748b">Booking: ${escapeHtml(invoice.booking.confirmationCode)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(Number(invoice.subtotal), invoice.currency)}</td></tr>
      ${taxRows}
      ${Number(invoice.discount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">−${formatCurrency(Number(invoice.discount), invoice.currency)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td style="text-align:right">${formatCurrency(Number(invoice.total), invoice.currency)}</td></tr>
      <tr class="paid"><td>Paid</td><td style="text-align:right">${formatCurrency(Number(invoice.paidAmount), invoice.currency)}</td></tr>
      <tr class="balance"><td>Balance Due</td><td style="text-align:right">${formatCurrency(Number(invoice.balance), invoice.currency)}</td></tr>
    </table>
  </div>

  ${policies ? `
  <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <div class="section-label">Policies</div>
    <div class="detail" style="white-space:pre-line">${escapeHtml(policies)}</div>
  </div>` : ''}

  <div class="footer">
    ${escapeHtml(legalName)} ${gstin ? `· GSTIN: ${escapeHtml(gstin)}` : ''} · This is a computer-generated invoice.
  </div>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
