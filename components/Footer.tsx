import { Logo } from "@/components/Logo";
import { navLinks, siteConfig } from "@/lib/site";

const socials = [
  { label: "Instagram", href: siteConfig.social.instagram },
  { label: "Facebook", href: siteConfig.social.facebook },
  { label: "TikTok", href: siteConfig.social.tiktok },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-cream/10 bg-dark-teal text-cream/70">
      <div className="container-px py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-11 w-11" />
              <span className="font-display text-xl font-semibold text-cream">
                Mobile Mulligans
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">
              Premium mobile golf simulator experiences for parties, corporate events,
              weddings, fundraisers, and more. We bring the course to you.
            </p>
            <a
              href={`https://${siteConfig.domain}`}
              className="mt-4 inline-block text-sm font-medium text-gold hover:underline"
            >
              {siteConfig.domain}
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-cream">
              Explore
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-gold">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-cream">
              Connect
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-gold"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${siteConfig.email}`} className="transition-colors hover:text-gold">
                  {siteConfig.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream/10 pt-6 text-xs text-cream/50 sm:flex-row">
          <p>
            &copy; {year} Mobile Mulligans. All rights reserved.
          </p>
          <p>Built for golf lovers &middot; {siteConfig.domain}</p>
        </div>
      </div>
    </footer>
  );
}
