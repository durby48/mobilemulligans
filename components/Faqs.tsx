const faqs = [
  {
    q: "How much space do you need?",
    a: "A typical setup needs roughly 10 feet of width, 10 feet of height, and 15 feet of depth for a comfortable full-swing bay. We can adapt to tighter spaces — just let us know your venue and we'll confirm the fit.",
  },
  {
    q: "What about power requirements?",
    a: "We run on standard household power — a single dedicated 110V outlet within reach of the setup area is all we need. For outdoor or remote locations without power, ask us about generator options.",
  },
  {
    q: "How long does setup and teardown take?",
    a: "Our team arrives ahead of your start time and typically needs 45–60 minutes to set up and about 45 minutes to tear down. Setup and teardown are included and never count against your play time.",
  },
  {
    q: "Can it be used indoors and outdoors?",
    a: "Both. We set up in garages, gyms, halls, tents, and event spaces, as well as outdoors on flat ground. Outdoor events need shelter from direct sun glare and rain for the equipment.",
  },
  {
    q: "What happens if the weather is bad?",
    a: "For outdoor bookings we monitor the forecast with you and recommend an indoor backup or covered area. If conditions aren't safe for the equipment, we'll work with you to reschedule.",
  },
  {
    q: "How far in advance should I book?",
    a: "Popular dates (weekends, holidays, and peak season) fill up fast, so 3–6 weeks ahead is ideal. Need something sooner? Reach out — we'll do our best to accommodate last-minute requests.",
  },
  {
    q: "What's your travel area?",
    a: "We serve the greater metro area and surrounding communities. Longer-distance events are welcome and may include a travel fee — send us your location for an exact quote.",
  },
  {
    q: "Do you provide a host or do we run it ourselves?",
    a: "Every event includes an on-site host who handles setup, gets your guests playing, runs contests, and manages teardown so you can enjoy the party.",
  },
];

export function Faqs() {
  return (
    <section id="faqs" className="py-20 sm:py-28">
      <div className="container-px">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">FAQs</span>
          <h2 className="section-heading mt-3">Questions, answered</h2>
          <p className="mt-4 text-lg text-dark-teal/70">
            Everything you need to know before booking. Still curious? Just ask in the form
            below.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-dark-teal/10 overflow-hidden rounded-2xl border border-dark-teal/10 bg-white/60">
          {faqs.map((faq) => (
            <details key={faq.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-medium text-dark-teal">
                {faq.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dark-teal/20 text-dark-teal transition-transform duration-200 group-open:rotate-45">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-dark-teal/70">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
