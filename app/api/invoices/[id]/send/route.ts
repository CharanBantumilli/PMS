import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiContext, hasRole, jsonError, jsonOk, logActivity } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'])) return jsonError('Forbidden', 403);

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { booking: { include: { guest: true, property: true } }, items: true },
  });
  if (!invoice) return jsonError('Invoice not found', 404);

  const guestEmail = invoice.booking?.guest?.email;
  if (!guestEmail) return jsonError('No email address on this booking\'s guest', 400);

  // Get SMTP config
  const smtpConfig = await prisma.integrationConfig.findUnique({
    where: { organizationId_type: { organizationId: ctx.organizationId, type: 'SMTP' as any } },
  });
  if (!smtpConfig || !smtpConfig.isEnabled) return jsonError('SMTP not configured. Go to Integrations → Settings to set up email.', 400);

  const config = smtpConfig.config as any;
  if (!config.host || !config.username || !config.password || !config.fromEmail) {
    return jsonError('SMTP configuration incomplete (missing host, credentials, or from email)', 400);
  }

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  const legalName = org?.legalName || org?.name;
  const gstin = org?.gstin || org?.taxId || null;

  // Build invoice summary for email body
  const itemLines = invoice.items.map((it) =>
    `  ${it.description} × ${Number(it.quantity)} = ${formatCurrency(Number(it.quantity) * Number(it.unitPrice), invoice.currency)}`
  ).join('\n');

  const guestName = invoice.booking ? `${invoice.booking.guest.firstName} ${invoice.booking.guest.lastName}` : '';

  const textBody = `Tax Invoice ${invoice.invoiceNumber}
Date: ${formatDate(invoice.issueDate)}  |  Due: ${formatDate(invoice.dueDate)}

From: ${legalName}${gstin ? ` (GSTIN: ${gstin})` : ''}
Bill To: ${guestName}

${itemLines}

Subtotal: ${formatCurrency(Number(invoice.subtotal), invoice.currency)}
Tax: ${formatCurrency(Number(invoice.taxAmount), invoice.currency)}
Total: ${formatCurrency(Number(invoice.total), invoice.currency)}
Paid: ${formatCurrency(Number(invoice.paidAmount), invoice.currency)}
Balance Due: ${formatCurrency(Number(invoice.balance), invoice.currency)}

Please find the attached invoice for your records.
`;

  const htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e293b;padding:24px">
<h2 style="margin:0 0 4px">Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>
<p style="color:#64748b;margin:0 0 16px">Date: ${formatDate(invoice.issueDate)} | Due: ${formatDate(invoice.dueDate)}</p>
<table style="width:100%;max-width:600px;border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 0;color:#64748b">From</td><td style="padding:4px 0;font-weight:600">${escapeHtml(legalName)}${gstin ? `<br><small>GSTIN: ${escapeHtml(gstin)}</small>` : ''}</td></tr>
<tr><td style="padding:4px 0;color:#64748b">Bill To</td><td style="padding:4px 0;font-weight:600">${escapeHtml(guestName)}</td></tr>
</table>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
<table style="width:100%;max-width:600px;border-collapse:collapse;font-size:14px">
<tr style="border-bottom:2px solid #e2e8f0"><th style="text-align:left;padding:8px 0;color:#94a3b8;font-size:11px;text-transform:uppercase">Description</th><th style="text-align:right;padding:8px 0;color:#94a3b8;font-size:11px;text-transform:uppercase">Amount</th></tr>
${invoice.items.map((it) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:8px 0">${escapeHtml(it.description)} × ${Number(it.quantity)}</td><td style="padding:8px 0;text-align:right">${formatCurrency(Number(it.quantity) * Number(it.unitPrice), invoice.currency)}</td></tr>`).join('')}
</table>
<table style="width:100%;max-width:600px;border-collapse:collapse;font-size:14px;margin-top:16px">
<tr><td style="padding:4px 0">Subtotal</td><td style="padding:4px 0;text-align:right">${formatCurrency(Number(invoice.subtotal), invoice.currency)}</td></tr>
<tr><td style="padding:4px 0">Tax</td><td style="padding:4px 0;text-align:right">${formatCurrency(Number(invoice.taxAmount), invoice.currency)}</td></tr>
<tr style="font-weight:700;font-size:16px;border-top:2px solid #0f172a"><td style="padding:8px 0">Total</td><td style="padding:8px 0;text-align:right">${formatCurrency(Number(invoice.total), invoice.currency)}</td></tr>
<tr style="color:#059669"><td style="padding:4px 0">Paid</td><td style="padding:4px 0;text-align:right">${formatCurrency(Number(invoice.paidAmount), invoice.currency)}</td></tr>
<tr style="color:#dc2626;font-weight:600"><td style="padding:4px 0">Balance Due</td><td style="padding:4px 0;text-align:right">${formatCurrency(Number(invoice.balance), invoice.currency)}</td></tr>
</table>
<p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">${legalName} · This is a computer-generated invoice.</p>
</body></html>`;

  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: String(config.host),
      port: Number(config.port || 587),
      secure: String(config.secure ?? 'false') === 'true',
      auth: { user: String(config.username), pass: String(config.password) },
    });

    await transport.sendMail({
      from: `"${legalName}" <${config.fromEmail}>`,
      to: guestEmail,
      subject: `Invoice ${invoice.invoiceNumber} — ${legalName}`,
      text: textBody,
      html: htmlBody,
    });

    await logActivity({
      organizationId: ctx.organizationId, userId: ctx.userId,
      action: 'INVOICE_SENT', entity: 'Invoice', entityId: invoice.id,
      description: `Invoice ${invoice.invoiceNumber} emailed to ${guestEmail}`,
    });

    return jsonOk({ ok: true, message: `Invoice sent to ${guestEmail}` });
  } catch (e: any) {
    const reason = e?.code === 'EAUTH' ? 'SMTP authentication failed'
      : e?.code === 'ECONNREFUSED' ? 'SMTP connection refused'
      : e?.code === 'ETIMEDOUT' ? 'SMTP connection timed out'
      : e?.message || 'Unknown email error';
    return jsonError(`Failed to send email: ${reason}`, 500);
  }
}
