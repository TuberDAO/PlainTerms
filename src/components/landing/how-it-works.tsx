import { FileText, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    icon: FileText,
    title: "1. Paste or upload",
    description:
      "Copy any contract clause, or upload the whole document. Works with leases, insurance policies, service agreements, and more.",
  },
  {
    icon: Search,
    title: "2. Detailed analysis",
    description:
      "Our AI reads every clause and flags what matters — hidden fees, tricky deadlines, unfair terms — explained in plain language. Large documents take a few minutes.",
  },
  {
    icon: ShieldCheck,
    title: "3. Know what to do",
    description:
      "Get specific action items: questions to ask, points to negotiate, and ready-to-send letter templates.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-muted/30 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Three steps to understanding any contract
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 md:gap-8">
          {STEPS.map((step) => (
            <Card key={step.title} className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center p-6 text-center sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
