"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";
import Link from "next/link";

interface ClauseRevealCardProps {
  clauseLabel: string;
  originalTextExcerpt: string;
  atFirstGlance: string;
  whatItMeans: string;
  scenario: string;
  whatToDo: string[];
  vertical?: string;
  showReportLink?: boolean;
  reportHref?: string;
}

export function ClauseRevealCard({
  clauseLabel,
  originalTextExcerpt,
  atFirstGlance,
  whatItMeans,
  scenario,
  whatToDo,
  vertical,
  showReportLink = true,
  reportHref = "/examples",
}: ClauseRevealCardProps) {
  const [revealed, setRevealed] = useState(false);
  const { locale } = useLocale();

  function toggle() {
    setRevealed((prev) => !prev);
    track("example_flip_toggle", {
      vertical: vertical ?? "general",
      locale,
      revealed: !revealed,
    });
  }

  return (
    <Card className="overflow-hidden border transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Clause excerpt */}
        <div className="border-b bg-muted/20 px-5 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {clauseLabel}
          </p>
          <p className="mt-2.5 max-w-prose text-sm italic leading-relaxed text-foreground/70">
            {originalTextExcerpt}
          </p>
        </div>

        {/* Toggle bar */}
        <button
          onClick={toggle}
          className="flex w-full items-center justify-between border-b px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/30 sm:px-6"
        >
          <span className="flex items-center gap-2">
            {revealed ? (
              <EyeOff className="h-4 w-4 text-primary/70" />
            ) : (
              <Eye className="h-4 w-4 text-primary/70" />
            )}
            {revealed ? "What it really means" : "At first glance"}
          </span>
          <motion.span
            animate={{ rotate: revealed ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.span>
        </button>

        {/* Content area */}
        <div className="px-5 py-5 sm:px-6">
          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="first-glance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg bg-muted/20 px-4 py-3"
              >
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {atFirstGlance}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="rounded-lg bg-red-50/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-700/70">
                    Plain meaning
                  </p>
                  <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-foreground/80">
                    {whatItMeans}
                  </p>
                </div>

                <div className="rounded-lg bg-amber-50/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/70">
                    Real-world scenario
                  </p>
                  <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-foreground/80">
                    {scenario}
                  </p>
                </div>

                <div className="px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What to do
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {whatToDo.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {showReportLink && (
                  <Link
                    href={reportHref}
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    See full report example
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
