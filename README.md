# PMS — Property Management System

A modern, Property Management System for hotels, hostels, vacation rentals, serviced apartments and boutique properties.

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **PostgreSQL** 16 (local or hosted — Supabase, Neon, Railway, etc.)

### 1. Clone & Install

```bash
git clone https://github.com/CharanBantumilli/PMS.git
cd pms
npm install
```

### 2. Database Setup

**Option A — Docker (all platforms)**

```bash
docker run -d --name pms-db \
  -e POSTGRES_USER=pms \
  -e POSTGRES_PASSWORD=pms123 \
  -e POSTGRES_DB=pms_saas \
  -p 5432:5432 postgres:16-alpine
```

**Option B — Local PostgreSQL**

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb pms_saas
```

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb pms_saas
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'pms123';"
```

**Windows:**
1. Download the installer from https://www.postgresql.org/download/windows/
2. Run the installer — set port to `5432`, password to `pms123`
3. During installation, make sure to check "Stack Builder" and install PostGIS if prompted
4. Open **pgAdmin** (installed with PostgreSQL) or use the SQL Shell:
   ```sql
   CREATE DATABASE pms_saas;
   ```

**Option C — Hosted (Supabase, Neon, etc.)**

Copy the connection string from your provider and paste it as `DATABASE_URL` in `.env`.

### 3. Environment Variables

Create a `.env` file in the project root:

```.env
# Database (replace with your PostgreSQL connection string)
DATABASE_URL="postgresql://postgres:pms123@localhost:5432/pms_saas"

# NextAuth (required)
NEXTAUTH_SECRET="generate-a-random-secret-at-least-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# App
APP_URL="http://localhost:3000"
```

That's all you need to get started.

### 4. Push Schema & Start

```bash
npx prisma db push
npx prisma generate
npm run dev
```

Open **http://localhost:3000**.

---

## Usage

### Register Your Property

1. Go to **http://localhost:3000/register**
2. Enter your **property/company name** and choose a workspace URL
3. Enter your **name**, **email**, and **password**
4. A 6-digit OTP will appear on screen (dev mode) — enter it to verify
5. Your organization is created and you're logged in as **Owner**

### Set Up Your Property

1. Go to **Properties** → click **Add Property**
2. Fill in details: name, code (e.g. `GH`), type (Hotel/Apartment/etc.), address, contact info
3. Go to **Unit Types** → add room categories (e.g. "Deluxe Room", "Suite") with base pricing and bed config
4. Go to **Units** → add individual rooms (e.g. "101", "102") and assign them to a unit type
5. Go to **Rate Plans** → create pricing plans (e.g. "Standard Rate" at ₹5,000/night)

### Create Bookings

1. Go to **Bookings** → click **New Booking**
2. Select a **guest** (or create one), **property**, **unit**, and **rate plan**
3. Set **arrival/departure dates**, guest counts
4. The system calculates the total automatically
5. Booking starts as **Pending** → **Check-in** when guest arrives → **Check-out** when they leave

### Manage Guests

- **Guests** page shows all guest profiles with contact info, stay history, and lifetime spend
- VIP levels and marketing consent flags help segment guests
- DPDPA-compliant: guests can request data export or erasure

### Finance

- **Invoices** are created automatically or manually per booking
- **Payments** can be recorded via Cash, Card, UPI, Bank Transfer, or Razorpay
- **Expenses** track property outgoings by category (Utilities, Supplies, Maintenance, etc.)
- **Reports** show revenue, occupancy, ADR, RevPAR, and source performance

### Housekeeping & Maintenance

- **Housekeeping** — assign cleaning/inspection tasks per unit with priorities and status tracking
- **Maintenance** — log issues (plumbing, HVAC, electrical) and track resolution

### Staff Management

1. Go to **Settings** → **Staff**
2. Click **Invite** to add team members with a role:
   - **Admin** — full access except billing
   - **Manager** — properties, units, bookings, operations
   - **Receptionist** — bookings, check-in/out, payments
   - **Housekeeper** — housekeeping tasks only
   - **Accountant** — invoices, payments, expenses, reports
3. Staff receive an invite link via email (or share the link manually)

### Settings

- **Organization** — name, logo, GSTIN, SAC code, branding color, check-in/out times
- **Integrations** — configure SMTP for email, Razorpay for payments, Slack for alerts
- **Staff** — manage team roles and permissions
- **Security** — change password, manage active sessions


## Email / SMTP Setup (Optional)

Without SMTP, OTP codes are displayed on-screen (dev mode). For production:

1. Go to **Settings** → **Integrations** → **SMTP**
2. Enter your SMTP host, port, username, password, and from email
3. Gmail example:
   - Host: `smtp.gmail.com`, Port: `587`
   - Username: your Gmail address
   - Password: App-specific password (not your regular password)

---

## Deployment

### Docker

```bash
docker compose up -d
```

### Manual

```bash
npm run build
npm start
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npx prisma db push   # Push schema changes to database
npx prisma generate  # Regenerate Prisma client
```

## License

MIT
