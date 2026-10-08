"use client";

import { useEffect } from "react";
import { useConsent } from "./ConsentProvider";

export function OneSignalGate() {
  const { consent } = useConsent();
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  useEffect(() => {
    if (consent !== "all" || !appId || typeof window === "undefined") {
      return;
    }

    if (document.querySelector('script[src="https://cdn.onesignal.com/sdks/OneSignalSDK.js"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/OneSignalSDK.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [consent, appId]);

  return null;
}
