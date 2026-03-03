"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ClauseCard } from "@/types/report";

function Section({
  title,
  children,
  bg,
}: {
  title: string;
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <div className={bg ? `rounded-lg px-4 py-3 ${bg}` : ""}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function ClauseCardFull({ clause }: { clause: ClauseCard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden rounded-xl">
      <CardContent className="p-0">
        {/* Clause header */}
        <div className="border-b bg-muted/20 px-5 py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {clause.clauseLabel}
          </p>
          <p className="mt-2.5 max-w-prose text-sm italic leading-relaxed text-foreground/70">
            {clause.originalTextExcerpt}
          </p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          {/* At first glance */}
          <Section title="At first glance" bg="bg-muted/20">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {clause.atFirstGlance}
            </p>
          </Section>

          {/* What it really means */}
          <Section title="What it really means" bg="bg-red-50/50">
            <p className="max-w-prose text-sm leading-relaxed text-foreground/80">
              {clause.whatItMeans}
            </p>
          </Section>

          {/* What could happen */}
          <Section title="What could happen" bg="bg-amber-50/50">
            <p className="max-w-prose text-sm leading-relaxed text-foreground/80">
              {clause.scenario}
            </p>
          </Section>

          {/* What to do */}
          <Section title="What to do">
            <ul className="space-y-1.5">
              {clause.whatToDo.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* Go deeper (expandable) */}
          {(clause.goDeeper || clause.risks || clause.negotiation) && (
            <div className="pt-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Go deeper
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-4 rounded-xl bg-muted/20 p-5">
                      {clause.goDeeper && (
                        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                          {clause.goDeeper}
                        </p>
                      )}

                      {clause.risks && clause.risks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Risks
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {clause.risks.map((risk, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                              >
                                <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" />
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {clause.negotiation && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Negotiation tips
                          </p>
                          {clause.negotiation.suggestedEdit && (
                            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Suggested edit:
                              </span>{" "}
                              {clause.negotiation.suggestedEdit}
                            </p>
                          )}
                          {clause.negotiation.fallbackAsk && (
                            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Fallback ask:
                              </span>{" "}
                              {clause.negotiation.fallbackAsk}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
