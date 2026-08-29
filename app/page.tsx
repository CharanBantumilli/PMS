import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, CreditCard, Users, Sparkles, Shield, BarChart3, Globe, Check, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">PMS</span>
          </Link>
          <nav className="hidden gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">Features</a>
            <a href="#modules" className="text-sm font-medium text-slate-600 hover:text-slate-900">Modules</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> All-in-one property management platform
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Run your properties with clarity and control.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-slate-600">
            PMS is a production-grade SaaS for hotels, hostels, vacation rentals and serviced apartments.
            Manage reservations, guests, housekeeping, maintenance and finance from a single dashboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/register">Start free trial <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Live demo</Link></Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">14-day free trial · No credit card required</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Properties managed', value: '12,400+' },
            { label: 'Bookings processed', value: '4.8M' },
            { label: 'Countries served', value: '60+' },
            { label: 'Customer rating', value: '4.9/5' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-t bg-white py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Built for the way you operate</h2>
            <p className="mt-4 text-slate-600">Everything you need to run a modern property operation — from reservations to revenue.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Calendar, title: 'Smart reservations', desc: 'Real-time availability, multi-channel inbox and a drag-and-drop timeline.' },
              { icon: Users, title: 'Guest CRM', desc: 'Unified guest profiles, stay history, preferences and marketing consent.' },
              { icon: CreditCard, title: 'Finance & invoices', desc: 'Invoicing, payments, expenses, taxes, multi-currency and reporting.' },
              { icon: Sparkles, title: 'Housekeeping', desc: 'Auto-generated task lists, live status boards and turnaround time metrics.' },
              { icon: Shield, title: 'Maintenance', desc: 'Ticket queue, priorities, vendor assignment and cost tracking.' },
              { icon: BarChart3, title: 'Reports & insights', desc: 'Occupancy, ADR, RevPAR, source performance and expense breakdown.' },
            ].map((f) => (
              <div key={f.title} className="group rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-900">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="border-t bg-slate-50 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">A complete operating system</h2>
            <p className="mt-4 text-slate-600">Every module is included — no add-on fees, no surprises.</p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              'Properties & unit inventory', 'Rate plans & seasonal pricing', 'Multi-channel reservations',
              'Guest profiles & preferences', 'Check-in / check-out workflow', 'Invoicing & payments',
              'Expenses & P&L tracking', 'Housekeeping task board', 'Maintenance ticket queue',
              'Staff & role-based access', 'Activity & audit logs', 'Custom reports & exports',
              'Multi-property dashboard', 'Multi-currency & multi-locale', 'API & webhooks',
              'White-label branding', 'Email & invoice templates', 'Data import & export',
            ].map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm">
                <Check className="h-4 w-4 text-emerald-600" /> <span className="text-slate-700">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t bg-white py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-slate-600">Start with a 14-day free trial. Cancel any time.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {[
              { name: 'Starter', price: '₹2,499', desc: 'For small properties and B&Bs', features: ['1 property', 'Up to 50 units', '5 users', 'Core modules', 'Email support'] },
              { name: 'Professional', price: '₹8,499', desc: 'For boutique hotels and groups', features: ['Up to 10 properties', 'Unlimited units', '25 users', 'All modules + reports', 'Priority support'], featured: true },
              { name: 'Enterprise', price: 'Custom', desc: 'For chains and large operators', features: ['Unlimited properties', 'SSO & SAML', 'Custom roles & audit', 'API access', 'Dedicated success manager'] },
            ].map((p) => (
              <div key={p.name} className={p.featured ? 'rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-lg' : 'rounded-2xl border bg-white p-6 shadow-sm'}>
                {p.featured && <div className="mb-3 inline-block rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">Most popular</div>}
                <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.desc}</p>
                <div className="mt-4"><span className="text-4xl font-bold text-slate-900">{p.price}</span>{p.price !== 'Custom' && <span className="text-slate-500"> /mo</span>}</div>
                <ul className="mt-6 space-y-2 text-sm text-slate-700">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> {f}</li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={p.featured ? 'default' : 'outline'}><Link href="/register">Get started</Link></Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t bg-slate-50 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Frequently asked</h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {[
              { q: 'How does the free trial work?', a: 'You get full access to every module for 14 days. No credit card required. At the end you can choose a plan or your account moves to read-only.' },
              { q: 'Can I import my existing data?', a: 'Yes — we support CSV import for properties, units, rate plans, guests and historical reservations. Our support team can help with larger migrations.' },
              { q: 'Is my data secure?', a: 'All data is encrypted in transit and at rest. We perform daily backups, role-based access, full audit logs and support SSO for enterprise customers.' },
              { q: 'Do you offer an API?', a: 'Yes, a REST API is available on the Professional plan and above. We also support webhooks for booking and payment events.' },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none font-medium text-slate-900">{f.q}</summary>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t bg-slate-900 py-12 text-slate-300">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Building2 className="h-4 w-4 text-white" /></div>
              <span className="text-lg font-bold text-white">PMS</span>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} PMS SaaS. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm">
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
