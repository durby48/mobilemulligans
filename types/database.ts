/**
 * Database types for Mobile Mulligans.
 * Mirrors the `booking_requests` table defined in the README SQL.
 */

export type BookingStatus = "new" | "contacted" | "booked" | "archived";

export type EventType =
  | "Corporate Event"
  | "Backyard / Private Party"
  | "Wedding"
  | "Fundraiser"
  | "School / Church Event"
  | "Golf League"
  | "Bachelor / Bachelorette Party"
  | "Other";

export type BookingRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  event_date: string | null;
  event_location: string | null;
  event_type: string | null;
  guest_count: number | null;
  message: string | null;
  status: BookingStatus;
};

/** Shape submitted by the public booking form (no server-managed fields). */
export type BookingRequestInput = {
  name: string;
  email: string;
  phone?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  event_type?: string | null;
  guest_count?: number | null;
  message?: string | null;
};

export type WaitlistSignup = {
  id: string;
  created_at: string;
  email: string;
  name: string | null;
  source: string | null;
};

/** Shape submitted by the public waitlist form. */
export type WaitlistSignupInput = {
  email: string;
  name?: string | null;
  source?: string | null;
};

/** What an authenticated employee may do once their scope is honored (mirrors
 *  @durbin/contracts OperatorRole). Owner → token scope "all"; others → company. */
export type OperatorRole = "owner" | "operator" | "viewer";

/** A person allowed into the remote-operations console. Keyed by login email;
 *  `company` is the home tenant ("mobile-mulligans" | "dc-solar"). RLS: a user
 *  may read only their own row; the /api/ops-token route reads it via service role. */
export type Employee = {
  id: string;
  created_at: string;
  email: string;
  company: string;
  role: OperatorRole;
  display_name: string | null;
  /** Optional explicit Gmail mailbox this employee may read (email inbox). When
   *  null/absent, the email routes derive a mailbox from company + login email.
   *  Only present once the owner runs the optional ALTER in config/EMAIL_SETUP.md. */
  mailbox?: string | null;
};

/** A money event in the finance durable plane. `company` is the home tenant
 *  ("mobile-mulligans" | "dc-solar"). RLS: a logged-in employee may read only
 *  their own company's rows; the /api/finance/* routes write via service role. */
export type FinanceType = "invoice" | "estimate" | "expense" | "payment";
export type FinanceDirection = "in" | "out";

/** One itemized line on a finance entry / its generated document. */
export type FinanceLineItem = {
  name?: string | null;
  description?: string | null;
  qty: number;
  rate: number;
};

export type FinanceEntry = {
  id: string;
  created_at: string;
  company: string;
  type: FinanceType;
  direction: FinanceDirection;
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  occurred_on: string | null;
  status: string;
  source_file: string | null;
  extracted: Record<string, unknown> | null;
  /** Pass 3 links (nullable; present once ws-customers-jobs-hours.sql is run). */
  customer_id?: string | null;
  job_id?: string | null;
  document_number?: string | null;
  document_path?: string | null;
  /** Itemized lines (jsonb; present once ws-finance-line-items.sql is run). */
  line_items?: FinanceLineItem[] | null;
};

/** Shape accepted by POST /api/finance/entry (company is server-derived). */
export type FinanceEntryInput = {
  type: FinanceType;
  direction: FinanceDirection;
  amount: number;
  currency?: string;
  counterparty?: string | null;
  description?: string | null;
  occurred_on?: string | null;
  status?: string;
  customer_id?: string | null;
  job_id?: string | null;
  document_number?: string | null;
  document_path?: string | null;
  line_items?: FinanceLineItem[] | null;
};

/** A customer in the per-company customer library (Supabase source of truth). */
export type Customer = {
  id: string;
  created_at: string;
  updated_at: string;
  company: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export type CustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type JobStatus = "active" | "completed" | "on_hold";

/** A job/project that hours, finance entries, and documents can reference. */
export type Job = {
  id: string;
  created_at: string;
  updated_at: string;
  company: string;
  name: string;
  customer_id: string | null;
  status: JobStatus;
  description: string | null;
  scheduled_for: string | null;
  scheduled_end: string | null;
  /** Per-company moniker (MM-26001); present once ws-jobs-numbering.sql is run. */
  job_number?: string | null;
  /** Service/site address; present once ws-jobs-address.sql is run. */
  address?: string | null;
};

export type JobInput = {
  name: string;
  customer_id?: string | null;
  status?: JobStatus;
  description?: string | null;
  scheduled_for?: string | null;
  scheduled_end?: string | null;
  job_number?: string | null;
  address?: string | null;
};

/** A logged block of employee time; labor cost = hours × rate. */
export type EmployeeHours = {
  id: string;
  created_at: string;
  company: string;
  employee: string;
  customer_id: string | null;
  job_id: string | null;
  occurred_on: string | null;
  hours: number;
  rate: number;
  description: string | null;
};

export type EmployeeHoursInput = {
  employee: string;
  customer_id?: string | null;
  job_id?: string | null;
  occurred_on?: string | null;
  hours: number;
  rate?: number;
  description?: string | null;
};

// ---------------------------------------------------------------------------
// Employee records vault (sensitive HR / payroll data).
//
// Access is locked to a single login (see lib/pii/authz.ts) and the SSN + bank
// numbers are stored ENCRYPTED (see lib/pii/crypto.ts) — the *_encrypted columns
// hold ciphertext, never plaintext. The *_last4 columns let the UI show a masked
// value without decrypting. RLS grants these tables to the service role only.
// ---------------------------------------------------------------------------

export type PayType = "hourly" | "salary";
export type BankAccountType = "checking" | "savings";
export type W4FilingStatus = "single" | "married_jointly" | "head_of_household";

/** One sensitive record per employee. Encrypted fields end in `_encrypted`. */
export type EmployeeRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  company: string;
  employee_id: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  ssn_encrypted: string | null;
  ssn_last4: string | null;
  bank_name: string | null;
  account_type: BankAccountType | null;
  routing_encrypted: string | null;
  account_encrypted: string | null;
  account_last4: string | null;
  w4_filing_status: W4FilingStatus | null;
  w4_multiple_jobs: boolean | null;
  w4_dependents_amount: number | null;
  w4_other_income: number | null;
  w4_deductions: number | null;
  w4_extra_withholding: number | null;
  pay_type: PayType | null;
  pay_rate: number | null;
  notes: string | null;
  updated_by: string | null;
};

export type EmployeeDocType = "w4" | "w2" | "paystub" | "payroll_report" | "other";

/** Metadata for a file stored in the private `employee-docs` storage bucket. */
export type EmployeeDocument = {
  id: string;
  created_at: string;
  company: string;
  employee_id: string;
  doc_type: EmployeeDocType;
  file_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  period_label: string | null;
  uploaded_by: string | null;
};

/** Immutable audit trail of every access to / change of the vault. */
export type EmployeeRecordAudit = {
  id: string;
  created_at: string;
  actor_email: string;
  company: string;
  employee_id: string | null;
  action: string;
  detail: string | null;
};

export type Database = {
  public: {
    Tables: {
      booking_requests: {
        Row: BookingRequest;
        Insert: BookingRequestInput & {
          id?: string;
          created_at?: string;
          status?: BookingStatus;
        };
        Update: Partial<BookingRequest>;
        Relationships: [];
      };
      employees: {
        Row: Employee;
        Insert: Omit<Employee, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Employee>;
        Relationships: [];
      };
      finance_entries: {
        Row: FinanceEntry;
        Insert: FinanceEntryInput & {
          id?: string;
          created_at?: string;
          company: string;
          currency?: string;
          status?: string;
          source_file?: string | null;
          extracted?: Record<string, unknown> | null;
        };
        Update: Partial<FinanceEntry>;
        Relationships: [];
      };
      waitlist_signups: {
        Row: WaitlistSignup;
        Insert: WaitlistSignupInput & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<WaitlistSignup>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: CustomerInput & { id?: string; created_at?: string; updated_at?: string; company: string };
        Update: Partial<Customer>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: JobInput & { id?: string; created_at?: string; updated_at?: string; company: string };
        Update: Partial<Job>;
        Relationships: [];
      };
      employee_hours: {
        Row: EmployeeHours;
        Insert: EmployeeHoursInput & { id?: string; created_at?: string; company: string };
        Update: Partial<EmployeeHours>;
        Relationships: [];
      };
      employee_records: {
        Row: EmployeeRecord;
        Insert: Partial<EmployeeRecord> & { company: string; employee_id: string };
        Update: Partial<EmployeeRecord>;
        Relationships: [];
      };
      employee_documents: {
        Row: EmployeeDocument;
        Insert: Omit<EmployeeDocument, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<EmployeeDocument>;
        Relationships: [];
      };
      employee_record_audit: {
        Row: EmployeeRecordAudit;
        Insert: Omit<EmployeeRecordAudit, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<EmployeeRecordAudit>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
