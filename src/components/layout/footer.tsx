import Link from "next/link";
import { Shield } from "lucide-react";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
];

const PRODUCT_LINKS = [
  { href: "/insurance", label: "Insurance" },
  { href: "/leases", label: "Leases" },
  { href: "/contracts", label: "Contracts" },
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <Shield className="h-5 w-5 text-primary" />
              PlainTerms
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Understand your contracts before you sign. Plain language
              analysis powered by AI.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Product</h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Get in touch</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Questions? Email us at{" "}
              <a
                href="mailto:hello@plainterms.io"
                className="underline hover:text-foreground"
              >
                hello@plainterms.io
              </a>
            </p>
          </div>
        </div>

        <div className="mt-12 border-t pt-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            This tool provides educational information only and does not
            constitute legal advice. Always consult a qualified legal
            professional for specific legal matters.
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PlainTerms. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
