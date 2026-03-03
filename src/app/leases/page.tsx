"use client";

import { VerticalLander } from "@/components/landing/vertical-lander";
import { heroExamples } from "@/data/hero-examples";
import { useLocale } from "@/lib/locale/context";
import { t } from "@/lib/locale/terminology";

const examples = heroExamples.filter((e) => e.vertical === "leases");

export default function LeasesPage() {
  const { locale } = useLocale();
  const agreement = t("leaseAgreement", locale);

  return (
    <VerticalLander
      vertical="leases"
      headline={`Understand your ${agreement} before you sign`}
      subheadline={`Entry rights, deposit deductions, and exit penalties — see what your ${agreement} really allows.`}
      bullets={[
        `${locale === "GB" ? "Landlord" : "Landlord"} access clauses that give less notice than you'd expect`,
        `Vague ${t("deposit", locale).toLowerCase()} deduction terms that could cost you hundreds`,
        "Early termination penalties that equal your remaining rent",
      ]}
      examples={examples}
    />
  );
}
