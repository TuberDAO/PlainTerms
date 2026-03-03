"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/tracker";
import { useLocale } from "@/lib/locale/context";
import { cn } from "@/lib/utils";

interface CTAButtonProps {
  href?: string;
  vertical?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
  onClick?: () => void;
}

export function CTAButton({
  href = "/analyze",
  vertical,
  variant = "default",
  size = "lg",
  label = "Try free scan",
  className,
  onClick,
}: CTAButtonProps) {
  const { locale } = useLocale();

  function handleClick() {
    track("cta_try_free_scan", { vertical: vertical ?? "general", locale });
    onClick?.();
  }

  const fullHref = vertical ? `${href}?vertical=${vertical}` : href;

  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn(
        "rounded-lg font-semibold shadow-sm transition-shadow hover:shadow-md",
        className
      )}
      onClick={handleClick}
    >
      <Link href={fullHref}>{label}</Link>
    </Button>
  );
}
