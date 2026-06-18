import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { HowItWorks } from "@/components/HowItWorks";
import { Pricing } from "@/components/Pricing";
import { Events } from "@/components/Events";
import { Membership } from "@/components/Membership";
import { Faqs } from "@/components/Faqs";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
  email: siteConfig.email,
  telephone: siteConfig.phone,
  priceRange: "$$",
  areaServed: siteConfig.serviceArea,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Pricing />
        <Events />
        <Membership />
        <Faqs />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
