"use client";

import { CTAButton } from "@/components/shared/cta-button";
import { ClauseRevealCard } from "@/components/clause/clause-reveal-card";
import { EmailCapture } from "@/components/landing/email-capture";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { HeroExample } from "@/types/report";

interface VerticalLanderProps {
  vertical: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  examples: HeroExample[];
}

export function VerticalLander({
  vertical,
  headline,
  subheadline,
  bullets,
  examples,
}: VerticalLanderProps) {
  return (
    <>
      {/* Hero section */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {subheadline}
            </p>

            <ul className="mx-auto mt-6 max-w-md space-y-2.5 text-left">
              {bullets.map((bullet, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  {bullet}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <CTAButton vertical={vertical} />
              <Button
                variant="outline"
                size="lg"
                className="rounded-lg"
                asChild
              >
                <Link href={`/examples?vertical=${vertical}`}>
                  See examples
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Sample clause cards */}
      <section className="bg-muted/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Common clauses we find
          </h2>
          <p className="mt-3 text-center text-base text-muted-foreground md:text-lg">
            Tap any card to see what the clause really means
          </p>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
            {examples.slice(0, 3).map((ex, i) => (
              <ClauseRevealCard
                key={i}
                clauseLabel={ex.clauseLabel}
                originalTextExcerpt={ex.originalTextExcerpt}
                atFirstGlance={ex.atFirstGlance}
                whatItMeans={ex.whatItMeans}
                scenario={ex.scenario}
                whatToDo={ex.whatToDo}
                vertical={vertical}
                reportHref={`/examples?vertical=${vertical}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Ready to check your contract?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Paste your contract text and get a plain-language breakdown in
            seconds. Free preview included.
          </p>
          <div className="mt-8">
            <CTAButton vertical={vertical} />
          </div>
        </div>
      </section>

      <EmailCapture
        vertical={vertical}
        heading="Stay informed"
        subheading="Get notified when we add new features and contract guides."
      />
    </>
  );
}
