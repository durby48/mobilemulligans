# Employee Records Vault — setup & compliance

This adds a **sensitive employee records vault** to the operations console:
home address, SSN, direct-deposit bank details, W-4 elections, and uploaded
documents (W-4, W-2, paystubs, payroll reports).

Access is locked to **one login** (`devonsd311@gmail.com` by default). SSN and
bank numbers are **encrypted at rest** with a server-only key; documents live in
a **private** storage bucket reachable only through short-lived signed URLs.
Every read of decrypted data and every change is written to an audit table.

> **Not legal advice.** Storing SSNs, bank/ACH details, and tax documents carries
> real obligations (state breach-notification + SSN-protection laws, IRS record
> retention, FTC Safeguards / NACHA expectations). Have a CPA or employment
> attorney confirm your obligations, and strongly consider a payroll provider
> (Gusto/ADP/QuickBooks) for live payroll — they absorb most of this liability.

---

## 1. Run the SQL (Supabase → SQL Editor)

```sql
-- Tables -------------------------------------------------------------------
create table if not exists public.employee_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  legal_first_name text,
  legal_last_name text,
  date_of_birth date,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  ssn_encrypted text,        -- ciphertext only (AES-256-GCM)
  ssn_last4 text,            -- for masked display, e.g. •••-••-1234
  bank_name text,
  account_type text,         -- 'checking' | 'savings'
  routing_encrypted text,    -- ciphertext only
  account_encrypted text,    -- ciphertext only
  account_last4 text,
  w4_filing_status text,
  w4_multiple_jobs boolean,
  w4_dependents_amount numeric,
  w4_other_income numeric,
  w4_deductions numeric,
  w4_extra_withholding numeric,
  pay_type text,             -- 'hourly' | 'salary'
  pay_rate numeric,
  notes text,
  updated_by text,
  unique (employee_id)
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  doc_type text not null,    -- 'w4' | 'w2' | 'paystub' | 'payroll_report' | 'other'
  file_path text not null,   -- path inside the private 'employee-docs' bucket
  file_name text not null,
  content_type text,
  size_bytes bigint,
  period_label text,         -- e.g. '2025 W-2' or '2026-06 paystub'
  uploaded_by text
);

create table if not exists public.employee_record_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text not null,
  company text not null,
  employee_id uuid,
  action text not null,      -- view | reveal | upsert | doc.upload | doc.download | doc.delete
  detail text
);

-- Row Level Security: lock to the service role ONLY -----------------------
-- With RLS enabled and NO policies created, the anon and authenticated roles
-- can read/write NOTHING. Only the service-role key (used exclusively by the
-- server routes, never shipped to the browser) bypasses RLS. This is the
-- database-level backstop behind the single-email gate in the API.
alter table public.employee_records       enable row level security;
alter table public.employee_documents     enable row level security;
alter table public.employee_record_audit  enable row level security;

-- Private storage bucket for tax/payroll documents ------------------------
insert into storage.buckets (id, name, public)
values ('employee-docs', 'employee-docs', false)
on conflict (id) do nothing;
-- storage.objects has RLS on by default; we add NO public policy, so the bucket
-- is reachable only via the service role + the signed URLs the API mints.
```

## 2. Set environment variables (server-only)

In Vercel → Project → Settings → Environment Variables (and `.env.local` for dev):

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Needed for storage upload + RLS-bypassing reads/writes. |
| `EMPLOYEE_PII_KEY` | **Yes** | 32-byte base64 key. Generate: `openssl rand -base64 32`. Encrypts SSN + bank numbers. |
| `RECORDS_ADMIN_EMAIL` | Optional | The single allowed login. Defaults to `devonsd311@gmail.com`. |

The records-admin email **must also exist as a row in `employees`** on this site
(so the route can resolve the company scope) — the same requirement as the other
console features. They sign in with the normal Supabase Auth login.

## 3. Verify the lockdown

- Log in as `devonsd311@gmail.com` → Employees tab → a 🔒 **Records** button appears per employee.
- Log in as **any other** employee (owner/operator/viewer) → the Records button is hidden, and `GET/PUT /api/employee-records` returns **403**.
- In the Supabase dashboard, confirm `employee_records` / `employee_documents` show **0 readable rows** under the anon role and the `employee-docs` bucket is **Private**.

---

## Compliance checklist (what this implements vs. what is still on you)

Implemented in code:

- [x] **Encryption at rest** for SSN + bank account/routing (AES-256-GCM, key in env).
- [x] **Single-identity access control**, enforced server-side on every request.
- [x] **RLS backstop** — DB denies all non-service-role access.
- [x] **Private documents** — no public bucket; 2-minute signed URLs only.
- [x] **Audit trail** of every reveal / change / upload / download / delete.
- [x] **Masking** — UI shows only last-4 of SSN/account unless explicitly revealed.
- [x] **TLS in transit** (Vercel + Supabase, automatic).

Still your responsibility (operational / legal):

- [ ] **Enable MFA** on the `devonsd311@gmail.com` Supabase login — the gate is only as strong as that login.
- [ ] **Protect the keys** — `EMPLOYEE_PII_KEY` and the service-role key define the trust boundary.
- [ ] **Retention & disposal policy** — IRS generally wants employment-tax records (incl. W-4) ~4 years; delete what you no longer need.
- [ ] **Data minimization** — only store fields you actually use.
- [ ] **Breach response plan** + confirm state notification duties (MO/KS and any employee's home state).
- [ ] **Consider a payroll provider** for live payroll/tax filing rather than hand-managing it.
- [ ] **Backups** — Supabase backs up the DB + bucket; confirm your plan's retention meets your needs.
