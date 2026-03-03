import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Home, FileText, ChevronRight } from "lucide-react";

const VERTICALS = [
  {
    href: "/insurance",
    icon: ShieldCheck,
    title: "Insurance & Finance",
    description:
      "Pet insurance, home insurance, personal loans — understand exclusions, caps, and hidden costs.",
  },
  {
    href: "/leases",
    icon: Home,
    title: "Leases & Tenancy",
    description:
      "Rental agreements, tenancy contracts — know your rights on deposits, access, and exit terms.",
  },
  {
    href: "/contracts",
    icon: FileText,
    title: "Consumer Contracts",
    description:
      "Gym memberships, cloud services, phone plans — spot auto-renew traps and data grabs.",
  },
];

export function WhoItsFor() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Who it&apos;s for
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Whether you&apos;re signing a lease, buying insurance, or
            subscribing to a service
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 md:gap-8">
          {VERTICALS.map((v) => (
            <Link key={v.href} href={v.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col p-6 sm:p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <v.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{v.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Learn more <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
