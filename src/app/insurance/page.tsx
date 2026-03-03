import { VerticalLander } from "@/components/landing/vertical-lander";
import { heroExamples } from "@/data/hero-examples";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insurance & Finance Contract Analysis — PlainTerms",
  description:
    "Understand your insurance policy before you sign. Spot hidden exclusions, premium traps, and claim limitations explained in plain language.",
};

const examples = heroExamples.filter((e) => e.vertical === "insurance");

export default function InsurancePage() {
  return (
    <VerticalLander
      vertical="insurance"
      headline="Understand your insurance policy before you sign"
      subheadline="Hidden exclusions, uncapped premiums, and narrow claim windows — our AI spots what the fine print is really saying."
      bullets={[
        "Pre-existing condition exclusions that are broader than they look",
        "Premium increases with no cap — your costs could double after a claim",
        "Claim filing deadlines that are easy to miss",
      ]}
      examples={examples}
    />
  );
}
