import type { BookingRequestInput, WaitlistSignupInput } from "@/types/database";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  data?: BookingRequestInput;
}

export interface WaitlistValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  data?: WaitlistSignupInput;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalizes a raw booking payload coming from the form / API.
 * Returns a cleaned object on success.
 */
export function validateBookingInput(raw: unknown): ValidationResult {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email);
  const phone = asTrimmedString(body.phone);
  const event_location = asTrimmedString(body.event_location);
  const event_type = asTrimmedString(body.event_type);
  const message = asTrimmedString(body.message);

  let event_date: string | null = asTrimmedString(body.event_date) || null;
  if (event_date && Number.isNaN(Date.parse(event_date))) {
    errors.event_date = "Please enter a valid date.";
    event_date = null;
  }

  let guest_count: number | null = null;
  const rawGuests = body.guest_count;
  if (rawGuests !== undefined && rawGuests !== null && rawGuests !== "") {
    const parsed = Number(rawGuests);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.guest_count = "Guest count must be a positive number.";
    } else {
      guest_count = Math.round(parsed);
    }
  }

  if (!name) errors.name = "Please tell us your name.";
  if (!email) {
    errors.email = "Please provide an email address.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please provide a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      name,
      email,
      phone: phone || null,
      event_date,
      event_location: event_location || null,
      event_type: event_type || null,
      guest_count,
      message: message || null,
    },
  };
}

/**
 * Validates and normalizes a raw waitlist payload. Email is lowercased so the
 * unique constraint dedupes case-insensitively.
 */
export function validateWaitlistInput(raw: unknown): WaitlistValidationResult {
  const errors: Record<string, string> = {};
  const body = (raw ?? {}) as Record<string, unknown>;

  const email = asTrimmedString(body.email).toLowerCase();
  const name = asTrimmedString(body.name);

  if (!email) {
    errors.email = "Please enter your email address.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please provide a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      email,
      name: name || null,
      source: "website",
    },
  };
}
