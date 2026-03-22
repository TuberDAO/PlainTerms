import {
  FileSearch,
  AlertTriangle,
  MessageSquare,
  FileEdit,
  BarChart3,
  Lock,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Clause-by-clause breakdown",
    description: "Every important clause explained in plain language.",
  },
  {
    icon: AlertTriangle,
    title: "Risk highlights",
    description: "See which clauses carry the most risk at a glance.",
  },
  {
    icon: MessageSquare,
    title: "Real-world scenarios",
    description: "Concrete examples of how each clause could affect you.",
  },
  {
    icon: FileEdit,
    title: "Letter templates",
    description: "Ready-to-send letters to negotiate or ask questions.",
  },
  {
    icon: BarChart3,
    title: "Overall verdict",
    description: "A clear summary so you know where you stand.",
  },
  {
    icon: Lock,
    title: "Privacy first",
    description: "Your document text is not kept after analysis. Only your report is saved to your account.",
  },
];

export function WhatYouGet() {
  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            What you get
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Everything you need to understand your contract
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
