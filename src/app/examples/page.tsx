"use client";

import { useState } from "react";
import { heroExamples } from "@/data/hero-examples";
import { ClauseRevealCard } from "@/components/clause/clause-reveal-card";
import { CTAButton } from "@/components/shared/cta-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "insurance", label: "Insurance & Finance" },
  { value: "leases", label: "Leases & Tenancy" },
  { value: "contracts", label: "Consumer Contracts" },
];

function ExamplesContent() {
  const searchParams = useSearchParams();
  const initialVertical = searchParams.get("vertical") ?? "all";
  const [filter, setFilter] = useState(initialVertical);

  const filtered =
    filter === "all"
      ? heroExamples
      : heroExamples.filter((ex) => ex.vertical === filter);

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Example clause breakdowns
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            See how common contract clauses look before and after analysis.
            Tap any card to reveal the plain meaning.
          </p>
        </div>

        <div className="mt-10 flex justify-center overflow-x-auto">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {filtered.map((ex, i) => (
            <ClauseRevealCard
              key={`${ex.vertical}-${i}`}
              clauseLabel={ex.clauseLabel}
              originalTextExcerpt={ex.originalTextExcerpt}
              atFirstGlance={ex.atFirstGlance}
              whatItMeans={ex.whatItMeans}
              scenario={ex.scenario}
              whatToDo={ex.whatToDo}
              vertical={ex.vertical}
              reportHref={`/report/demo-${ex.vertical === "leases" ? "lease" : ex.vertical === "contracts" ? "contract" : "insurance"}`}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-muted-foreground">
            No examples for this category yet. Check back soon.
          </p>
        )}

        <div className="mt-16 text-center">
          <CTAButton label="Try with your own contract" />
        </div>
      </div>
    </div>
  );
}

export default function ExamplesPage() {
  return (
    <Suspense>
      <ExamplesContent />
    </Suspense>
  );
}
