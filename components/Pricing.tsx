import { CheckIcon } from "@/components/icons";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  featured?: boolean;
  cta: string;
};

const plans: Plan[] = [
  {
    name: "Private Party",
    price: "$499",
    cadence: "starting / 3 hours",
    description: "Perfect for backyard gatherings, birthdays, and casual get-togethers.",
    features: [
      "Up to 3 hours of play",
      "Full simulator setup & teardown",
      "On-site host & support",
      "Closest-to-the-pin contest",
    ],
    cta: "Book a Party",
  },
  {
    name: "Corporate Event",
    price: "$899",
    cadence: "starting / 4 hours",
    description: "Impress clients and reward teams with a polished, branded experience.",
    features: [
      "Up to 4 hours of play",
      "Custom tournament & leaderboard",
      "Dedicated event host",
      "Optional company branding",
      "Premium course package",
    ],
    featured: true,
    cta: "Plan Your Event",
  },
  {
    name: "Wedding / Fundraiser",
    price: "$799",
    cadence: "starting / 4 hours",
    description: "A memorable activity for receptions, charity events, and large groups.",
    features: [
      "Up to 4 hours of play",
      "Contest & prize setup",
      "Donation / sponsor signage",
      "Flexible indoor or outdoor setup",
    ],
    cta: "Reserve a Date",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="dimple-bg py-20 sm:py-28">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="section-heading mt-3">Packages for every kind of event</h2>
          <p className="mt-4 text-lg text-dark-teal/70">
            Transparent starting rates. Every event is custom — reach out for an exact quote
            based on your dates, location, and guest count.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover ${
                plan.featured
                  ? "border-gold bg-dark-teal text-cream"
                  : "border-dark-teal/10 bg-white/70"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-semibold uppercase tracking-wide text-dark-teal">
                  Most Popular
                </span>
              )}
              <h3
                className={`font-display text-2xl font-semibold ${
                  plan.featured ? "text-cream" : "text-dark-teal"
                }`}
              >
                {plan.name}
              </h3>
              <p
                className={`mt-1 text-sm ${
                  plan.featured ? "text-cream/70" : "text-dark-teal/60"
                }`}
              >
                {plan.description}
              </p>
              <div className="mt-5 flex items-baseline gap-2">
                <span
                  className={`font-display text-4xl font-semibold ${
                    plan.featured ? "text-gold" : "text-dark-teal"
                  }`}
                >
                  {plan.price}
                </span>
                <span
                  className={`text-sm ${
                    plan.featured ? "text-cream/60" : "text-dark-teal/55"
                  }`}
                >
                  {plan.cadence}
                </span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.featured ? "text-gold" : "text-sage"
                      }`}
                    />
                    <span className={plan.featured ? "text-cream/85" : "text-dark-teal/75"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={`mt-8 w-full ${plan.featured ? "btn-primary" : "btn-secondary"}`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Custom quote card */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-dark-teal/10 bg-gradient-to-r from-sage to-dark-teal p-8 shadow-card sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h3 className="font-display text-2xl font-semibold text-cream sm:text-3xl">
                Need something custom?
              </h3>
              <p className="mt-2 max-w-xl text-cream/80">
                Multi-day events, leagues, large guest counts, or a unique venue? Tell us
                what you have in mind and we&apos;ll build a custom event quote just for you.
              </p>
            </div>
            <a href="#contact" className="btn-primary shrink-0 text-base">
              Request a Custom Quote
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-dark-teal/55">
          Pricing shown is a placeholder starting point and may vary by travel distance,
          season, and event needs.
        </p>
      </div>
    </section>
  );
}
