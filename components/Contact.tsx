import { BookingForm } from "@/components/BookingForm";
import { MailIcon, PhoneIcon, MapPinIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site";

export function Contact() {
  return (
    <section id="contact" className="bg-dark-teal py-20 sm:py-28">
      <div className="container-px grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="eyebrow text-gold">Book an Event</span>
          <h2 className="section-heading mt-3 text-cream">
            Let&apos;s bring the simulator to you
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-cream/75">
            Tell us about your event and we&apos;ll follow up with availability, pricing, and
            everything you need to lock in your date. The more detail you share, the faster we
            can tailor your quote.
          </p>

          <ul className="mt-9 space-y-5">
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-gold">
                <MailIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-cream/50">Email</p>
                <a href={`mailto:${siteConfig.email}`} className="text-cream hover:text-gold">
                  {siteConfig.email}
                </a>
              </div>
            </li>
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-gold">
                <PhoneIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-cream/50">Phone</p>
                <a href={`tel:${siteConfig.phone.replace(/[^\d+]/g, "")}`} className="text-cream hover:text-gold">
                  {siteConfig.phone}
                </a>
              </div>
            </li>
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-gold">
                <MapPinIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-cream/50">Service Area</p>
                <p className="text-cream">{siteConfig.serviceArea}</p>
              </div>
            </li>
          </ul>
        </div>

        <BookingForm />
      </div>
    </section>
  );
}
