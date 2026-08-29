# PMS — Production Property Management SaaS

A production-grade, multi-tenant Property Management System (PMS) for hotels, hostels, vacation rentals, serviced apartments and boutique properties. Built with **Next.js 14**, **Prisma**, **NextAuth**, and **Tailwind CSS**.

## Features

- **Multi-tenant by design** — each organization has isolated data, users and billing
- **Properties & units** — hotels, apartments, villas, hostels, B&Bs with rich unit inventory
- **Unit types** — categories with base price, occupancy, bed/bath config and amenities
- **Reservations** — full booking lifecycle (pending → confirmed → checked-in → checked-out) with availability checks, multi-channel source tracking, and guest counts
- **Guest CRM** — unified guest profiles with stay history, VIP levels, marketing consent
- **Rate plans** — base rates, refundable/non-refundable, meal plans, min/max stay
- **Calendar** — 14-day reservation timeline across units
- **Housekeeping** — task board with status workflow, priorities, assignees, auto-generated tasks
- **Maintenance** — ticket queue with priorities, costs, vendor assignment
- **Invoices & payments** — multi-method payments, auto balance updates, status tracking
- **Expenses** — categorized outgoings with monthly comparisons
- **Reports** — revenue, occupancy, ADR, RevPAR, source performance, top guests
- **Staff & roles** — role-based access control (Owner, Admin, Manager, Receptionist, Housekeeper, Accountant) with invite links
- **Activity log** — full audit trail of changes
- **Settings** — organization profile, branding, plan & billing management
- **Beautiful landing page** — marketing site with features, modules, pricing and FAQ

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL (Prisma ORM)
- **Auth**: NextAuth.js with JWT sessions, Credentials provider
- **UI**: Tailwind CSS, Radix UI primitives, custom shadcn-style components
- **Validation**: Zod
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Icons**: Lucide React
- **Deployment**: Docker + Docker Compose

## Quick Start (Docker)

```bash
git clone <repo>
cd pms-saas
cp .env.example .env
# Edit .env and set NEXTAUTH_SECRET
docker compose up -d
```

Open http://localhost:3000, create an account, and you're in.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up the database (PostgreSQL)
# Option A: use Docker for just the DB
docker run -d --name pms-pg -e POSTGRES_USER=pms -e POSTGRES_PASSWORD=pms123 -e POSTGRES_DB=pms_saas -p 5432:5432 postgres:16-alpine

# 3. Configure environment
cp .env.example .env
# Edit .env if needed

# 4. Push schema and generate Prisma client
npx prisma db push
npx prisma generate

# 5. (Optional) Seed demo data
npm run db:seed

# 6. Start dev server
npm run dev
```

Demo credentials after seeding: `demo@azurebay.com` / `demo1234`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://pms:pms123@localhost:5432/pms_saas` |
| `NEXTAUTH_URL` | Base URL of the app | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT signing secret (REQUIRED in production) | — |
| `APP_URL` | Public app URL used in invitation links | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe API key for billing | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |

## Architecture

### Multi-tenancy
Every business entity (Property, Unit, Booking, Guest, Invoice, etc.) carries an `organizationId`. Middleware enforces authentication; API helpers scope all queries to the caller's organization.

### Roles
- `OWNER` — full control, billing, can delete organization
- `ADMIN` — manage staff, settings, all data
- `MANAGER` — manage properties, units, bookings, operations
- `RECEPTIONIST` — create bookings, check-in/out, record payments
- `HOUSEKEEPER` — housekeeping tasks only
- `ACCOUNTANT` — invoices, payments, expenses, reports

### Data Model
See `prisma/schema.prisma` — 30+ models covering the full PMS domain.

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run db:push      # Push schema to database
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
```

## Deployment

The included `Dockerfile` produces a standalone Next.js build. Use `docker compose` for the full stack (app + Postgres). For production:

1. Set a strong `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
2. Use a managed PostgreSQL (RDS, Supabase, Neon, etc.)
3. Put behind HTTPS (Caddy, Nginx, Cloudflare)
4. Configure Stripe for billing
5. Set up email delivery for invitations (SMTP/SendGrid/Resend)
6. Configure backups

## License

MIT
