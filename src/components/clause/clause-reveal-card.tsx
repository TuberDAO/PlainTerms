"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";
import Link from "next/link";

const REDUCED_MOTION: Partial<Record<string, number>> = {};
const ANIM_DURATION = 0.2;

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

        {/* Toggle bar — keyboard-accessible */}
        <button
          onClick={toggle}
          aria-expanded={revealed}
          className="flex w-full items-center justify-between border-b px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
        >
          <span className="flex items-center gap-2">
            {revealed ? (
              <EyeOff className="h-4 w-4 text-primary/70" />
            ) : (
              <Eye className="h-4 w-4 text-primary/70" />
            )}
            {revealed ? "Reality check" : "At first glance"}
          </span>
          <motion.span
            animate={{ rotate: revealed ? 90 : 0 }}
            transition={{ duration: ANIM_DURATION, ...REDUCED_MOTION }}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.span>
        </button>

        {/* Content area — fixed min-height prevents layout jump */}
        <div className="min-h-[120px] px-5 py-5 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            {!revealed ? (
              <motion.div
                key="first-glance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: ANIM_DURATION }}
                className="space-y-4"
              >
                <div className="rounded-lg bg-emerald-50/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700/70">
                    At first glance
                  </p>
                  <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {atFirstGlance}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2">
                  <Button
                    size="sm"
                    onClick={toggle}
                    aria-expanded={revealed}
                    className="gap-2 rounded-lg"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Reveal the catch
                  </Button>
                  <p className="text-xs text-muted-foreground/60">
                    Tap to see what this clause really means
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: ANIM_DURATION }}
                className="space-y-4"
              >
                <div className="rounded-lg bg-red-50/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-700/70">
                    What it really means
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

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggle}
                    aria-expanded={revealed}
                    className="gap-2 rounded-lg"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Back to first glance
                  </Button>
                  {showReportLink && (
                    <Link
                      href={reportHref}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      See full report example
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
