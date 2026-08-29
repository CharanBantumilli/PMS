'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

// Approximate FX rates (USD base). In production these would come from a live FX API.
const USD_TO: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.2, AUD: 1.52, CAD: 1.36, JPY: 149.5,
  CHF: 0.88, CNY: 7.24, SGD: 1.34, HKD: 7.82, NZD: 1.64, MXN: 17.0, BRL: 4.95,
  ZAR: 18.5, AED: 3.67, SAR: 3.75, KRW: 1330, THB: 35.5, MYR: 4.7, IDR: 15700,
  PHP: 56.0, VND: 24300, EGP: 48.5, NGN: 1480, KES: 130, PKR: 285, BDT: 110,
  LKR: 310, NOK: 10.5, SEK: 10.3, DKK: 6.85, PLN: 3.95, CZK: 22.5, HUF: 355,
  RUB: 92.0, TRY: 31.5, ILS: 3.7, TWD: 32.0,
};

const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN', JPY: 'ja-JP',
  CNY: 'zh-CN', AUD: 'en-AU', CAD: 'en-CA', CHF: 'de-CH', BRL: 'pt-BR',
};

const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: ['1 property', 'Up to 50 units', '5 users', 'Core modules'],
  PROFESSIONAL: ['Up to 10 properties', 'Unlimited units', '25 users', 'All modules + reports', 'Priority support'],
  ENTERPRISE: ['Unlimited properties', 'SSO & SAML', 'API access', 'Dedicated success manager'],
};

const PLAN_PRICES_USD: Record<string, number | null> = {
  STARTER: 29, PROFESSIONAL: 99, ENTERPRISE: null,
};

function localizedCurrency(amountUsd: number, currency: string): string {
  const rate = USD_TO[currency] || 1;
  const converted = amountUsd * rate;
  // For zero-decimal currencies (JPY, KRW, VND, IDR), round to integer
  const zeroDecimal = ['JPY', 'KRW', 'VND', 'IDR'].includes(currency);
  const locale = CURRENCY_LOCALES[currency] || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(zeroDecimal ? Math.round(converted) : converted);
}

export function BillingPanel({ plan, planStatus, trialEndsAt, currentPeriodEnd, stripeCustomerId, currency }: { plan: string; planStatus: string; trialEndsAt: string | null; currentPeriodEnd: string | null; stripeCustomerId: string | null; currency: string }) {
  async function changePlan(name: string) {
    const res = await fetch('/api/organization/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: name }) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed'); return; }
    toast.success(`Plan changed to ${name}`);
    location.reload();
  }
  const plans: { name: string; price: number | null; features: string[] }[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].map((n) => ({ name: n, price: PLAN_PRICES_USD[n], features: PLAN_FEATURES[n] }));
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase text-slate-500">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold">{plan}</span>
              <Badge variant={planStatus === 'ACTIVE' ? 'success' : planStatus === 'TRIAL' ? 'warning' : 'destructive'}>{planStatus.toLowerCase()}</Badge>
            </div>
            {planStatus === 'TRIAL' && trialEndsAt && <div className="text-xs text-slate-500">Trial ends {formatDate(trialEndsAt)}</div>}
            {planStatus === 'ACTIVE' && currentPeriodEnd && <div className="text-xs text-slate-500">Renews {formatDate(currentPeriodEnd)}</div>}
            {stripeCustomerId && <div className="text-xs text-slate-500">Stripe customer: {stripeCustomerId}</div>}
            <div className="mt-1 text-xs text-slate-500">Billing currency: <span className="font-semibold text-slate-700">{currency}</span></div>
          </div>
          {plan !== 'ENTERPRISE' && (
            <Button variant="outline" disabled><CreditCard className="h-4 w-4" /> Manage via Stripe portal</Button>
          )}
        </div>
      </CardContent></Card>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.name === plan;
          const displayPrice = p.price ? localizedCurrency(p.price, currency) : null;
          return (
            <Card key={p.name} className={isCurrent ? 'border-2 border-slate-900 p-5' : 'p-5'}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {isCurrent && <Badge>Current</Badge>}
              </div>
              <div className="mt-2 text-2xl font-bold">{displayPrice ? `${displayPrice}/mo` : 'Custom'}</div>
              {p.price && currency !== 'USD' && <div className="text-xs text-slate-500">(billed in {currency})</div>}
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-600" /> {f}</li>)}
              </ul>
              {!isCurrent && (
                <Button className="mt-4 w-full" onClick={() => changePlan(p.name)}>{p.name === 'ENTERPRISE' ? 'Contact sales' : 'Switch plan'}</Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
