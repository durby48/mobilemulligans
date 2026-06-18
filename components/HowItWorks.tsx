import { CalendarIcon, TruckIcon, FlagIcon } from "@/components/icons";

const steps = [
  {
    icon: CalendarIcon,
    step: "01",
    title: "Pick Your Date",
    body: "Tell us about your event and reserve your date. We'll confirm availability and lock in your setup.",
  },
  {
    icon: TruckIcon,
    step: "02",
    title: "We Bring the Simulator",
    body: "Our team arrives early, sets up the full simulator bay indoors or outdoors, and dials everything in.",
  },
  {
    icon: FlagIcon,
    step: "03",
    title: "Play, Compete & Enjoy",
    body: "Your guests tee off on legendary courses and contests. When it's over, we pack up and you relax.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-dark-teal py-20 sm:py-28">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow text-gold">How It Works</span>
          <h2 className="section-heading mt-3 text-cream">Three easy steps to tee time</h2>
          <p className="mt-4 text-lg text-cream/70">
            Booking premium golf for your event has never been simpler.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, ...item }) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-cream/10 bg-cream/[0.04] p-8 transition-colors hover:border-gold/40"
            >
              <span className="font-display text-5xl font-semibold text-gold/30">
                {item.step}
              </span>
              <span className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold text-cream">
                {item.title}
              </h3>
              <p className="mt-2.5 leading-relaxed text-cream/70">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
