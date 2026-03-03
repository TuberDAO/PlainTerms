import { VerticalLander } from "@/components/landing/vertical-lander";
import { heroExamples } from "@/data/hero-examples";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consumer Contract Analysis — PlainTerms",
  description:
    "Spot auto-renew traps, data grabs, and unfair terms in gym memberships, cloud services, phone plans, and more.",
};

const examples = heroExamples.filter((e) => e.vertical === "contracts");

export default function ContractsPage() {
  return (
    <VerticalLander
      vertical="contracts"
      headline="Don't let the fine print catch you out"
      subheadline="Auto-renew traps, silent price increases, and broad data permissions — know what you're agreeing to."
      bullets={[
        "Subscriptions that auto-renew at higher prices without telling you",
        "Content licences that let companies use your data for AI training",
        "Terms that can change at any time with no notification",
      ]}
      examples={examples}
    />
  );
}
