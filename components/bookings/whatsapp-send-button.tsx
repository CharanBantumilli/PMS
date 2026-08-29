'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectHTML } from '@/components/ui/select-native';
import { MessageCircle, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { value: 'booking_confirmation', label: 'Booking confirmation', variables: ['Guest name', 'Confirmation code', 'Arrival date', 'Departure date', 'Total amount'] },
  { value: 'checkin_reminder', label: 'Check-in reminder', variables: ['Guest name', 'Arrival date', 'Property name'] },
  { value: 'checkout_reminder', label: 'Check-out reminder', variables: ['Guest name', 'Departure date'] },
  { value: 'payment_received', label: 'Payment received', variables: ['Guest name', 'Amount', 'Confirmation code'] },
  { value: 'invoice_sent', label: 'Invoice sent', variables: ['Guest name', 'Invoice number', 'Total', 'Due date'] },
  { value: 'review_request', label: 'Review request', variables: ['Guest name', 'Property name', 'Review link'] },
];

export function WhatsAppSendButton({ bookingId, guestName, guestPhone }: { bookingId: string; guestName: string; guestPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'template' | 'text'>('template');
  const [template, setTemplate] = useState('booking_confirmation');
  const [variables, setVariables] = useState<string[]>(['', '', '', '', '']);
  const [customMessage, setCustomMessage] = useState('');

  if (!guestPhone) {
    return (
      <Button variant="outline" size="sm" disabled title="Guest has no phone number on file">
        <MessageCircle className="h-3 w-3" /> No phone
      </Button>
    );
  }

  const selectedTemplate = TEMPLATES.find((t) => t.value === template);

  async function send() {
    setLoading(true);
    try {
      const body: any = { bookingId, mode };
      if (mode === 'template') {
        body.template = template;
        body.variables = variables.filter((v) => v.trim() !== '');
      } else {
        body.customMessage = customMessage;
      }
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send');
        return;
      }
      toast.success('WhatsApp message sent');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" /> Send WhatsApp to {guestName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">To: {guestPhone}</p>
          <div className="flex gap-2 border-b">
            <button onClick={() => setMode('template')} className={`px-3 py-1 text-sm ${mode === 'template' ? 'border-b-2 border-slate-900 font-semibold' : 'text-slate-500'}`}>Template</button>
            <button onClick={() => setMode('text')} className={`px-3 py-1 text-sm ${mode === 'text' ? 'border-b-2 border-slate-900 font-semibold' : 'text-slate-500'}`}>Custom message</button>
          </div>

          {mode === 'template' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="tpl">Template</Label>
                <SelectHTML id="tpl" value={template} onChange={(e) => { setTemplate(e.target.value); setVariables(new Array(TEMPLATES.find((t) => t.value === e.target.value)?.variables.length || 5).fill('')); }}>
                  {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </SelectHTML>
              </div>
              {selectedTemplate && (
                <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600">Variables:</p>
                  {selectedTemplate.variables.map((vName, i) => (
                    <div key={i} className="space-y-1">
                      <Label htmlFor={`var-${i}`} className="text-xs">{`{{${i + 1}}} = ${vName}`}</Label>
                      <Input id={`var-${i}`} value={variables[i] || ''} onChange={(e) => { const next = [...variables]; next[i] = e.target.value; setVariables(next); }} placeholder={vName} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'text' && (
            <div className="space-y-1.5">
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" rows={4} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Type your message here..." />
              <p className="text-xs text-slate-500">Text messages can only be sent within 24 hours of the guest's last message (WhatsApp policy).</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={send} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
