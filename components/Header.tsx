"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { MenuIcon, CloseIcon } from "@/components/icons";
import { navLinks, siteConfig } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-dark-teal/95 shadow-lg backdrop-blur"
          : "bg-dark-teal/85 backdrop-blur-sm"
      }`}
    >
      <div className="container-px flex h-16 items-center justify-between sm:h-20">
        <a href="#top" className="flex items-center gap-3" aria-label={`${siteConfig.name} home`}>
          <Logo variant="badge" onDark className="h-10 w-10 sm:h-12 sm:w-12" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold text-cream sm:text-xl">
              Mobile Mulligans
            </span>
            <span className="hidden text-[0.65rem] uppercase tracking-[0.25em] text-gold sm:block">
              Mobile Golf Simulator
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-cream/80 transition-colors hover:text-gold"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/login"
            className="inline-flex items-center rounded-full border border-gold/50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-gold transition-colors hover:bg-gold hover:text-dark-teal"
          >
            Employee Login
          </a>
          <a href="#contact" className="btn-primary">
            Book an Event
          </a>
        </nav>

        <button
          type="button"
          className="text-cream lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden ${open ? "block" : "hidden"} border-t border-cream/10 bg-dark-teal`}
      >
        <nav className="container-px flex flex-col gap-1 py-4" aria-label="Mobile">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-cream/90 transition-colors hover:bg-cream/10 hover:text-gold"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-lg border border-gold/40 px-3 py-3 text-base font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            Employee Login
          </a>
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="btn-primary mt-3 w-full"
          >
            Book an Event
          </a>
        </nav>
      </div>
    </header>
  );
}
