const eventTypes = [
  {
    title: "Corporate Outings",
    body: "Team building, client entertainment, and office celebrations with leaderboards and branding.",
  },
  {
    title: "Backyard Parties",
    body: "Turn any backyard or garage into the neighborhood's favorite hangout.",
  },
  {
    title: "Weddings",
    body: "A unique reception activity that keeps guests of all ages entertained.",
  },
  {
    title: "Fundraisers",
    body: "Charity tournaments and sponsor-friendly contests that raise more.",
  },
  {
    title: "School & Church Events",
    body: "Family-friendly fun for festivals, lock-ins, and community nights.",
  },
  {
    title: "Golf Leagues",
    body: "Recurring league play and simulator nights all season long.",
  },
  {
    title: "Bachelor & Bachelorette",
    body: "A premium way to celebrate before the big day — swing, sip, and compete.",
  },
  {
    title: "Pop-Up & Promo",
    body: "Grand openings, trade shows, and brand activations that draw a crowd.",
  },
];

export function Events() {
  return (
    <section id="events" className="py-20 sm:py-28">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Events We Power</span>
          <h2 className="section-heading mt-3">Perfect for nearly any occasion</h2>
          <p className="mt-4 text-lg text-dark-teal/70">
            If people are gathering, we can bring the golf. Here are just a few of the events
            Mobile Mulligans loves to host.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {eventTypes.map((event) => (
            <div
              key={event.title}
              className="group rounded-2xl border border-dark-teal/10 bg-white/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:bg-white hover:shadow-card-hover"
            >
              <span className="block h-1 w-10 rounded-full bg-gold transition-all duration-300 group-hover:w-16" />
              <h3 className="mt-4 font-display text-lg font-semibold text-dark-teal">
                {event.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-dark-teal/70">{event.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
