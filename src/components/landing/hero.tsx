"use client";

import { CTAButton } from "@/components/shared/cta-button";
import { ClauseRevealCard } from "@/components/clause/clause-reveal-card";
import { heroExamples } from "@/data/hero-examples";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye } from "lucide-react";
import Link from "next/link";

export function Hero() {
  const example = heroExamples[0];

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy + CTAs */}
          <div>
            <h1 className="max-w-lg text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              Know what you&apos;re{" "}
              <span className="text-primary">really</span> signing
            </h1>
            <p className="mt-5 max-w-prose text-base leading-relaxed text-muted-foreground md:text-lg">
              Paste any contract clause and get a plain-language breakdown of
              what it actually means, what could go wrong, and what to do
              about it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAButton />
              <Button
                variant="outline"
                size="lg"
                className="rounded-lg"
                asChild
              >
                <Link href="/examples">See examples</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Free preview — no account required. Not legal advice.
            </p>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap items-center gap-5 border-t pt-6">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Private &amp; secure
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Document not kept after analysis
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                Results in minutes
              </span>
            </div>
          </div>

          {/* Right: interactive Clause Reveal Card in elevated container */}
          <div className="w-full lg:ml-auto lg:max-w-md">
            <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Live example
              </p>
              <ClauseRevealCard
                clauseLabel={example.clauseLabel}
                originalTextExcerpt={example.originalTextExcerpt}
                atFirstGlance={example.atFirstGlance}
                whatItMeans={example.whatItMeans}
                scenario={example.scenario}
                whatToDo={example.whatToDo}
                vertical={example.vertical}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
