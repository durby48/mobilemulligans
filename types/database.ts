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
};

/** A money event in the finance durable plane. `company` is the home tenant
 *  ("mobile-mulligans" | "dc-solar"). RLS: a logged-in employee may read only
 *  their own company's rows; the /api/finance/* routes write via service role. */
export type FinanceType = "invoice" | "estimate" | "expense" | "payment";
export type FinanceDirection = "in" | "out";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
