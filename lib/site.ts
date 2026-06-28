export const siteConfig = {
  name: "Mobile Mulligans",
  domain: "mobilemulligans.net",
  url: "https://mobilemulligans.net",
  tagline: "We Bring the Golf Simulator to You",
  description:
    "Premium mobile golf simulator rentals for parties, corporate events, weddings, fundraisers, and private gatherings. We bring the course to you.",
  email: "info@mobilemulligans.net",
  phone: "816-274-2415",
  serviceArea: "Serving the greater Kansas City metro area & surrounding communities",
  /** "Write a review" link used in customer emails. Override with env REVIEW_URL
   *  (set to your Google "write a review" link for best results). */
  reviewUrl: "https://www.google.com/search?q=Mobile+Mulligans+golf+simulator+reviews",
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/",
  },
} as const;

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Pricing", href: "#pricing" },
  { label: "Events", href: "#events" },
  { label: "Membership", href: "#membership" },
  { label: "FAQs", href: "#faqs" },
  { label: "Contact", href: "#contact" },
] as const;
