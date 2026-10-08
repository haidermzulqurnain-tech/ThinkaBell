"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useConsent } from "./ConsentProvider";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { consent, setConsent } = useConsent();

  useEffect(() => {
    setMounted(true);
    if (!consent || consent === "none") {
      setIsVisible(true);
    }
  }, [consent]);

  const applyConsent = (state: "all" | "essential") => {
    setConsent(state);
    setIsVisible(false);
  };

  if (!mounted || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Cookie Consent</h3>
            <p className="mt-1 text-sm text-gray-600">
              We use cookies to enhance your browsing experience, serve personalized content,
              and analyze our traffic. By clicking &quot;Accept All&quot;, you consent to our use of cookies.
              See our{" "}
              <a href="/legal/privacy-policy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>{" "}
              for more information.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => applyConsent("essential")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Essential Only
            </button>
            <button
              onClick={() => applyConsent("all")}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
