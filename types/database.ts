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
