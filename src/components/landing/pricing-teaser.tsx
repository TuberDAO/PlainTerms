import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CTAButton } from "@/components/shared/cta-button";

export function PricingTeaser() {
  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Start free, upgrade when you need to
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Get a free preview of any contract with the key findings highlighted.
          Unlock the full report with detailed analysis, action items, and
          letter templates.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CTAButton label="Try free scan" />
          <Button
            variant="outline"
            size="lg"
            className="rounded-lg"
            asChild
          >
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          One-off reports from $4.99 — no subscription required
        </p>
      </div>
    </section>
  );
}
