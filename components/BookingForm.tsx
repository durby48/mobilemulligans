"use client";

import { useState, type FormEvent } from "react";

const eventTypeOptions = [
  "Corporate Event",
  "Backyard / Private Party",
  "Wedding",
  "Fundraiser",
  "School / Church Event",
  "Golf League",
  "Bachelor / Bachelorette Party",
  "Other",
];

type Status = "idle" | "submitting" | "success" | "error";

const inputClasses =
  "w-full rounded-xl border border-dark-teal/15 bg-white px-4 py-3 text-dark-teal placeholder-dark-teal/40 shadow-sm outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-dark-teal";

export function BookingForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      event_date: formData.get("event_date"),
      event_location: formData.get("event_location"),
      event_type: formData.get("event_type"),
      guest_count: formData.get("guest_count"),
      message: formData.get("message"),
    };

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "Something went wrong. Please try again.");
        if (data?.errors) setFieldErrors(data.errors);
        return;
      }

      setStatus("success");
      setMessage(data?.message ?? "Thanks! We'll be in touch shortly.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again or email us directly.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-sage/30 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/15 text-sage">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5 11-11" />
          </svg>
        </div>
        <h3 className="mt-4 font-display text-2xl font-semibold text-dark-teal">
          Request received!
        </h3>
        <p className="mt-2 text-dark-teal/70">{message}</p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage("");
          }}
          className="btn-secondary mt-6"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-dark-teal/10 bg-white/80 p-6 shadow-card sm:p-8"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className={labelClasses}>
            Name <span className="text-gold">*</span>
          </label>
          <input id="name" name="name" type="text" required autoComplete="name" className={inputClasses} placeholder="Jane Doe" />
          {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="email" className={labelClasses}>
            Email <span className="text-gold">*</span>
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClasses} placeholder="jane@email.com" />
          {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className={labelClasses}>Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputClasses} placeholder="(555) 123-4567" />
        </div>

        <div>
          <label htmlFor="event_date" className={labelClasses}>Event Date</label>
          <input id="event_date" name="event_date" type="date" className={inputClasses} />
          {fieldErrors.event_date && <p className="mt-1 text-sm text-red-600">{fieldErrors.event_date}</p>}
        </div>

        <div>
          <label htmlFor="event_type" className={labelClasses}>Event Type</label>
          <select id="event_type" name="event_type" defaultValue="" className={inputClasses}>
            <option value="" disabled>Select an event type</option>
            {eventTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="guest_count" className={labelClasses}>Estimated Guest Count</label>
          <input id="guest_count" name="guest_count" type="number" min="0" inputMode="numeric" className={inputClasses} placeholder="25" />
          {fieldErrors.guest_count && <p className="mt-1 text-sm text-red-600">{fieldErrors.guest_count}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="event_location" className={labelClasses}>Event Location</label>
          <input id="event_location" name="event_location" type="text" className={inputClasses} placeholder="City, venue, or full address" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className={labelClasses}>Message</label>
          <textarea id="message" name="message" rows={4} className={inputClasses} placeholder="Tell us about your event, ideas, or questions..." />
        </div>
      </div>

      {status === "error" && message && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <button type="submit" disabled={status === "submitting"} className="btn-primary mt-6 w-full text-base disabled:cursor-not-allowed disabled:opacity-60">
        {status === "submitting" ? "Sending..." : "Send Booking Request"}
      </button>
      <p className="mt-3 text-center text-xs text-dark-teal/55">
        We&apos;ll never share your information. Expect a reply within 1–2 business days.
      </p>
    </form>
  );
}
