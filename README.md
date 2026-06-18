# Mobile Mulligans

Premium **mobile golf simulator** experiences for parties, corporate events, weddings, fundraisers, and private gatherings. This is the marketing site + booking lead capture for [mobilemulligans.net](https://mobilemulligans.net).

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase**. Deployed on **Vercel**.

---

## Tech Stack

| Layer        | Tool                         |
| ------------ | ---------------------------- |
| Framework    | Next.js 14 (App Router)      |
| Language     | TypeScript                   |
| Styling      | Tailwind CSS                 |
| Backend/DB   | Supabase (Postgres + Auth)   |
| Hosting      | Vercel                       |
| Domain       | mobilemulligans.net          |

## Project Structure

```
app/                 App Router pages, layout, API routes, sitemap/robots
  api/booking/       POST endpoint that saves booking requests to Supabase
components/          UI sections (Header, Hero, Pricing, BookingForm, etc.)
lib/                 Site config, validation, Supabase clients
  supabase/          Browser + server Supabase clients
public/              Logo and icon SVG assets (replaceable placeholders)
styles/              Global Tailwind styles + brand tokens
types/               Database + booking types
```

## Getting Started (Local Dev)

### 1. Prerequisites

- Node.js 18.18+ (LTS recommended)
- A Supabase project ([supabase.com](https://supabase.com))

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

| Variable                        | Required | Description                                              |
| ------------------------------- | -------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL (Settings → API)                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anon/public key (Settings → API)                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Optional | Service role key for trusted server inserts (server-only) |

> The booking API uses the service role key when present (bypasses RLS). If you
> only use the anon key, make sure the RLS INSERT policy below is in place.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Setup

Run this SQL in the Supabase **SQL Editor** to create the `booking_requests` table
and a policy that lets the public booking form insert rows safely.

```sql
-- Table
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  event_date date,
  event_location text,
  event_type text,
  guest_count integer,
  message text,
  status text not null default 'new'
);

-- Enable Row Level Security
alter table public.booking_requests enable row level security;

-- Allow anonymous + authenticated visitors to submit a booking request.
create policy "Allow public inserts"
  on public.booking_requests
  for insert
  to anon, authenticated
  with check (true);

-- Reads are NOT public. Only the service role (server) / dashboard can read.
-- (No SELECT policy is created, so anon/auth cannot read rows.)
```

### Waitlist signups table

The homepage "Join the Wishlist" section (Kansas City launch, summer 2026) saves
emails to a separate `waitlist_signups` table:

```sql
-- Table
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique,
  name text,
  source text default 'website'
);

-- Enable Row Level Security
alter table public.waitlist_signups enable row level security;

-- Allow anonymous + authenticated visitors to join the waitlist.
create policy "Allow public waitlist inserts"
  on public.waitlist_signups
  for insert
  to anon, authenticated
  with check (true);
```

### Reviewing submissions

View incoming leads in the Supabase dashboard under **Table Editor →
`booking_requests`**, and waitlist emails under **Table Editor →
`waitlist_signups`**, or build an admin view using the service role key.

## Available Scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `npm run dev`    | Start the local dev server        |
| `npm run build`  | Production build                  |
| `npm run start`  | Run the production build locally  |
| `npm run lint`   | Lint with ESLint                  |

## Deployment (Vercel)

1. Push this repo to GitHub (`https://github.com/durby48/mobilemulligans.git`).
2. In [Vercel](https://vercel.com), **Import** the GitHub repository.
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optionally `SUPABASE_SERVICE_ROLE_KEY`) in
   **Project → Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

### Connecting the domain (Squarespace / registrar)

1. In Vercel: **Project → Settings → Domains → Add** `mobilemulligans.net`.
2. In your domain registrar (Squarespace) DNS settings, add the records Vercel
   shows you:
   - An `A` record for the apex domain `@` → Vercel's IP, **or** an `ALIAS`/`CNAME`
     if supported.
   - A `CNAME` record for `www` → `cname.vercel-dns.com`.
3. Wait for DNS to propagate; Vercel issues SSL automatically.

## Branding

| Token      | Hex       |
| ---------- | --------- |
| Cream      | `#F4E8D5` |
| Tan        | `#D8C1A0` |
| Gold       | `#A78B63` |
| Sage/Teal  | `#4C7B72` |
| Dark Teal  | `#1F3A3B` |

The logo (`public/logo.svg`, `components/Logo.tsx`) is a placeholder circular
monogram in dark teal + gold. Swap in final brand assets when ready.

## Notes

- All copy, imagery, and branding are original to Mobile Mulligans.
- Pricing figures are placeholders — update in `components/Pricing.tsx`.
- Contact details live in `lib/site.ts`.
