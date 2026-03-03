"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";

interface EmailCaptureProps {
  vertical?: string;
  heading?: string;
  subheading?: string;
}

export function EmailCapture({
  vertical,
  heading = "Get early access",
  subheading = "Be the first to know when new features launch. No spam, ever.",
}: EmailCaptureProps) {
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");

    try {
      const utm =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("utm_params") || "{}")
          : {};

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, vertical, locale, utm }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage("You\u2019re on the list!");
        setEmail("");
        track("lead_captured", { vertical: vertical ?? "general", locale });
      } else {
        const data = await res.json();
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  }

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {heading}
        </h2>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          {subheading}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-2"
        >
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 flex-1 rounded-lg"
            disabled={status === "loading" || status === "success"}
          />
          <Button
            type="submit"
            size="lg"
            className="rounded-lg font-semibold shadow-sm"
            disabled={status === "loading" || status === "success"}
          >
            {status === "loading" ? "Joining..." : "Notify me"}
          </Button>
        </form>

        {message && (
          <p
            className={`mt-3 text-sm ${
              status === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
