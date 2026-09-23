'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export function InvoiceActions({ invoiceId, guestEmail, invoiceNumber }: { invoiceId: string; guestEmail?: string | null; invoiceNumber: string }) {
  const [sending, setSending] = useState(false);

  async function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { toast.error('Pop-up blocked'); return; }
    const res = await fetch(`/api/invoices/${invoiceId}/print`);
    if (!res.ok) { toast.error('Failed to load invoice'); return; }
    const html = await res.text();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  }

  async function handleSend() {
    if (!guestEmail) { toast.error('No guest email on this booking'); return; }
    if (!confirm(`Send invoice ${invoiceNumber} to ${guestEmail}?`)) return;
    setSending(true);
    const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { toast.error(data.error || 'Failed to send'); return; }
    toast.success(`Invoice sent to ${guestEmail}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" /> Print
      </Button>
      <Button variant="outline" size="sm" onClick={handleSend} disabled={sending || !guestEmail}>
        {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />} Send
      </Button>
    </div>
  );
}
