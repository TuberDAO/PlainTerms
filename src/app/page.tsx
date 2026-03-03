import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SeeTheDifference } from "@/components/landing/see-the-difference";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { WhoItsFor } from "@/components/landing/who-its-for";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { EmailCapture } from "@/components/landing/email-capture";
import { FAQ } from "@/components/landing/faq";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <SeeTheDifference />
      <WhatYouGet />
      <WhoItsFor />
      <PricingTeaser />
      <EmailCapture />
      <FAQ />
    </>
  );
}
