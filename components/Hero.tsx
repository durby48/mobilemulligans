import { Logo } from "@/components/Logo";
import { FlagIcon, MapPinIcon, SparkleIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-dark-teal pt-28 pb-20 sm:pt-32 sm:pb-28"
    >
      <div className="dimple-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sage/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />

      <div className="container-px relative grid items-center gap-12 lg:grid-cols-2">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <SparkleIcon className="h-4 w-4" />
            Premium Mobile Golf Experiences
          </span>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] text-cream sm:text-5xl lg:text-6xl">
            We Bring the Golf
            <br />
            <span className="text-gold">Simulator to You</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
            {siteConfig.description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#contact" className="btn-primary text-base">
              Book an Event
            </a>
            <a href="#pricing" className="btn-on-dark text-base">
              View Pricing
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-cream/70">
            <span className="inline-flex items-center gap-2">
              <FlagIcon className="h-5 w-5 text-gold" />
              Realistic course play
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-gold" />
              {siteConfig.serviceArea}
            </span>
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sage/40 to-gold/20 blur-2xl" />
            <div className="relative flex h-full w-full items-center justify-center rounded-[2rem] border border-cream/15 bg-gradient-to-br from-[#274a4b] to-[#16292a] p-10 shadow-2xl">
              <Logo variant="full" onDark showUrl className="h-full w-full drop-shadow-2xl" />
            </div>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-cream/15 bg-dark-teal/90 px-6 py-2.5 text-center shadow-lg backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-gold">Tee off anywhere</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
