import { CheckIcon } from "@/components/icons";

const highlights = [
  {
    title: "Total Convenience",
    body: "No tee times, no travel, no course required. We deliver and set up a full simulator bay wherever you are.",
  },
  {
    title: "Realistic Play",
    body: "Pro-grade launch tracking and famous courses make every swing feel like the real thing — for rookies and scratch golfers alike.",
  },
  {
    title: "Built for Entertainment",
    body: "Closest-to-the-pin, long-drive contests, and team scrambles keep every guest engaged, not just the golfers.",
  },
];

export function About() {
  return (
    <section id="about" className="py-20 sm:py-28">
      <div className="container-px grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="eyebrow">About Mobile Mulligans</span>
          <h2 className="section-heading mt-3">
            The golf experience that comes to your front door
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-dark-teal/75">
            Mobile Mulligans transforms any space into a premium golf destination. We pack
            a high-end simulator, screen, turf, and everything else into a clean, modern
            setup and bring it straight to your event.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-dark-teal/75">
            Whether it&apos;s a backyard hangout, a corporate mixer, or a wedding reception,
            your guests step up, swing away, and play world-famous courses — no membership,
            no tee time, and no green fees required.
          </p>
        </div>

        <div className="grid gap-5">
          {highlights.map((item) => (
            <div key={item.title} className="card flex gap-4 hover:shadow-card-hover">
              <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage">
                <CheckIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold text-dark-teal">
                  {item.title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-dark-teal/70">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
