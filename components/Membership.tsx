import { TrophyIcon, CalendarIcon, SparkleIcon } from "@/components/icons";

const perks = [
  {
    icon: CalendarIcon,
    title: "Priority Booking",
    body: "First access to weekend dates and peak-season availability.",
  },
  {
    icon: TrophyIcon,
    title: "League Play",
    body: "Join recurring simulator leagues with standings, prizes, and bragging rights.",
  },
  {
    icon: SparkleIcon,
    title: "Member Rates",
    body: "Exclusive pricing on recurring bookings and member-only events.",
  },
];

export function Membership() {
  return (
    <section id="membership" className="bg-tan/40 py-20 sm:py-28">
      <div className="container-px">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="eyebrow">Membership &amp; Leagues</span>
            <h2 className="section-heading mt-3">
              Coming soon: recurring play &amp; member perks
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-dark-teal/75">
              We&apos;re building memberships and seasonal leagues for golfers who want more
              than a one-time event. Be the first to know when spots open up — and help shape
              what we offer.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {perks.map(({ icon: Icon, ...perk }) => (
                <div key={perk.title} className="rounded-xl bg-white/70 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/15 text-sage">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-dark-teal">{perk.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-dark-teal/65">{perk.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dark-teal/10 bg-dark-teal p-8 shadow-card sm:p-10">
            <h3 className="font-display text-2xl font-semibold text-cream">
              Join the Interest List
            </h3>
            <p className="mt-2 text-cream/75">
              Tell us you&apos;re interested and we&apos;ll reach out with launch details,
              founding-member pricing, and early league sign-ups.
            </p>
            <a href="#contact" className="btn-primary mt-6 w-full text-base">
              Join the Interest List
            </a>
            <p className="mt-4 text-center text-xs text-cream/55">
              No commitment — just early access and updates.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
