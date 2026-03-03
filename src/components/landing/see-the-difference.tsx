"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CTAButton } from "@/components/shared/cta-button";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";

const PANELS = [
  {
    step: "The clause says",
    content:
      '"Premiums are subject to adjustment at each Renewal Date based on claims history and market conditions, without limitation as to the amount of increase."',
    bg: "bg-muted/30",
    accent: "border-l-4 border-l-muted-foreground/20",
  },
  {
    step: "What most people think",
    content:
      "Premiums might go up a bit each year as your pet gets older. Standard stuff — every insurance does this.",
    bg: "bg-amber-50/60",
    accent: "border-l-4 border-l-amber-300",
  },
  {
    step: "What it actually allows",
    content:
      "There is no cap on how much your premium can increase. After a couple of claims, the cost could rise significantly — potentially making coverage unaffordable right when you need it.",
    bg: "bg-red-50/60",
    accent: "border-l-4 border-l-red-300",
  },
];

const WHAT_TO_DO_BULLETS = [
  "Ask your insurer if there is a maximum annual increase percentage before you sign.",
  "Compare policies that offer rate-lock or capped-increase guarantees.",
  "Set a calendar reminder 60 days before renewal to review and switch if needed.",
];

export function SeeTheDifference() {
  const { locale } = useLocale();
  const firedRef = useRef(false);

  function handleAccordionChange(value: string) {
    if (value && !firedRef.current) {
      firedRef.current = true;
      track("see_difference_what_to_do_open", { locale });
    }
  }

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            See the difference
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            The same clause, three perspectives
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 md:gap-8">
          {PANELS.map((panel) => (
            <Card
              key={panel.step}
              className={`border-0 shadow-sm ${panel.bg} ${panel.accent}`}
            >
              <CardContent className="p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {panel.step}
                </p>
                <p className="mt-3 max-w-prose text-sm leading-relaxed">
                  {panel.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Collapsible "What to do next" — default collapsed */}
        <div className="mx-auto mt-8 max-w-2xl">
          <Accordion
            type="single"
            collapsible
            onValueChange={handleAccordionChange}
          >
            <AccordionItem value="what-to-do" className="border-b-0">
              <AccordionTrigger className="justify-center gap-2 py-3 text-sm font-medium text-primary hover:no-underline">
                What to do next (60 seconds)
              </AccordionTrigger>
              <AccordionContent className="pb-2 pt-1">
                <div className="rounded-xl border bg-card px-5 py-5 shadow-sm sm:px-6">
                  <ul className="space-y-2.5">
                    {WHAT_TO_DO_BULLETS.map((bullet, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <CTAButton size="default" label="Try free scan" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
