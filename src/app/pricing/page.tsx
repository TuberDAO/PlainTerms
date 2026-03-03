"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { PAID_TIER } from "@/lib/budget";
import { track } from "@/lib/analytics/tracker";
import { CTAButton } from "@/components/shared/cta-button";

export default function PricingPage() {
  useEffect(() => {
    track("pricing_viewed");
  }, []);

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Start with a free preview. Pay only when you want the full report.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8">
          {/* One-off */}
          <Card className="rounded-xl">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold">
                {PAID_TIER.oneOff.label}
              </h2>
              <p className="mt-2 text-3xl font-bold">
                {PAID_TIER.oneOff.priceDisplay}
              </p>
              <p className="text-sm text-muted-foreground">per report</p>

              <ul className="mt-8 space-y-3">
                {PAID_TIER.oneOff.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button className="mt-8 w-full rounded-lg" disabled>
                Coming soon
              </Button>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="rounded-xl border-primary shadow-md">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {PAID_TIER.subscription.label}
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Best value
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">
                {PAID_TIER.subscription.priceDisplay}
              </p>
              <p className="text-sm text-muted-foreground">per month</p>

              <ul className="mt-8 space-y-3">
                {PAID_TIER.subscription.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button className="mt-8 w-full rounded-lg" disabled>
                Coming soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Free tier */}
        <div className="mt-12 rounded-xl border bg-muted/30 p-8 text-center">
          <h3 className="text-base font-semibold">Free preview</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every contract scan includes a free preview with the overall
            verdict and 2–3 key findings. No account or payment required.
          </p>
          <div className="mt-5">
            <CTAButton label="Try free scan" />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Payments powered by Stripe (coming soon). All prices in USD. Cancel
          subscription anytime.
        </p>
      </div>
    </div>
  );
}
