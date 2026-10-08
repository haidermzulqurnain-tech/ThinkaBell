"use client";

import { useEffect } from "react";
import { useConsent } from "../components/ConsentProvider";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent !== "all") return;
    import("../lib/posthog").then(({ initPostHog }) => initPostHog());
  }, [consent]);

  return <>{children}</>;
}
