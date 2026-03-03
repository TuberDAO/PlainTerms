"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { track } from "@/lib/analytics/tracker";

export function PaywallBlock({ count }: { count: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      {/* Blurred preview layer */}
      <div className="space-y-4 p-5 blur-sm sm:p-6">
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-muted/50 p-5">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="mt-3 h-3 w-full rounded bg-muted" />
            <div className="mt-1.5 h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 px-6 backdrop-blur-[2px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-center text-base font-semibold">
          {count} more finding{count !== 1 ? "s" : ""} in the full report
        </p>
        <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          Unlock the complete analysis with action items and letter templates.
        </p>
        <Button
          className="mt-5 rounded-lg font-semibold shadow-sm"
          size="lg"
          asChild
          onClick={() => track("paywall_viewed")}
        >
          <Link href="/pricing">Unlock full report</Link>
        </Button>
      </div>
    </div>
  );
}
