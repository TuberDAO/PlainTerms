"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { setConsent } from "@/lib/analytics/tracker";

function hasConsentCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("analytics_consent=");
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsentCookie()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleAccept() {
    setConsent(true);
    setVisible(false);
  }

  function handleDecline() {
    setConsent(false);
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 p-4 backdrop-blur-sm">
      <div className="container mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies and analytics to improve your experience. No tracking
          until you accept.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
