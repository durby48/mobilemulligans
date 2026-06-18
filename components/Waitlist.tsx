"use client";

import { useState, type FormEvent } from "react";
import { MailIcon, MapPinIcon, SparkleIcon, TrophyIcon } from "@/components/icons";

type Status = "idle" | "submitting" | "success" | "error";

export function Waitlist() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage(data?.message ?? "You're on the list!");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again in a moment.");
    }
  }

  return (
    <section
      id="waitlist"
      className="relative overflow-hidden bg-gold py-16 sm:py-20"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-cream/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-dark-teal/15 blur-3xl" />

      <div className="container-px relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-dark-teal/30 bg-dark-teal/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-dark-teal">
            <MapPinIcon className="h-4 w-4" />
            Coming to Kansas City — Summer 2026
          </span>

          <h2 className="mt-6 font-display text-3xl font-semibold leading-tight text-dark-teal sm:text-4xl">
            Join the Wishlist
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-dark-teal/80">
            Mobile Mulligans is bringing premium mobile golf simulator experiences to
            the greater Kansas City metro area in summer 2026. Add your email and be
            the first to know when we tee off.
          </p>

          <div className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-3 rounded-xl border border-dark-teal/25 bg-dark-teal px-5 py-4 text-left text-cream">
            <TrophyIcon className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
            <p className="text-sm sm:text-base">
              <span className="font-semibold text-gold">Early-bird offer:</span> the
              first <span className="font-semibold">100 wishlisters</span> and first{" "}
              <span className="font-semibold">10 event bookers</span> get{" "}
              <span className="font-semibold text-gold">20% off</span> their first event.
            </p>
          </div>

          {status === "success" ? (
            <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-3 rounded-xl border border-dark-teal/30 bg-cream px-5 py-4 text-dark-teal">
              <SparkleIcon className="h-5 w-5 shrink-0 text-sage" />
              <span>{message}</span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
              noValidate
            >
              <label htmlFor="waitlist-name" className="sr-only">
                Name
              </label>
              <input
                id="waitlist-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="First name (optional)"
                className="min-w-0 flex-1 rounded-xl border border-dark-teal/20 bg-cream px-4 py-3 text-dark-teal placeholder-dark-teal/45 outline-none transition focus:border-dark-teal focus:ring-2 focus:ring-dark-teal/25"
              />
              <label htmlFor="waitlist-email" className="sr-only">
                Email
              </label>
              <div className="relative min-w-0 flex-1">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-teal/45" />
                <input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="w-full rounded-xl border border-dark-teal/20 bg-cream py-3 pl-11 pr-4 text-dark-teal placeholder-dark-teal/45 outline-none transition focus:border-dark-teal focus:ring-2 focus:ring-dark-teal/25"
                />
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="shrink-0 rounded-xl bg-dark-teal px-6 py-3 text-base font-semibold text-cream shadow-sm transition hover:bg-[#16292a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Joining..." : "Join the Wishlist"}
              </button>
            </form>
          )}

          {status === "error" && message && (
            <p className="mx-auto mt-4 max-w-md rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </p>
          )}

          <p className="mt-4 text-xs text-dark-teal/65">
            No spam — just a heads-up when we launch in Kansas City.
          </p>
        </div>
      </div>
    </section>
  );
}
