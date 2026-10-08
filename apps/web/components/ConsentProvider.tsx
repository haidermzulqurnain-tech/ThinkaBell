"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ConsentState = "all" | "essential" | "none";

interface ConsentContextValue {
  consent: ConsentState;
  setConsent: (state: ConsentState) => void;
}

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentState>("none");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("cookie-consent") as ConsentState | null;
    if (saved) {
      setConsentState(saved);
    }
  }, []);

  const setConsent = (state: ConsentState) => {
    setConsentState(state);
    if (state) {
      localStorage.setItem("cookie-consent", state);
    }
    window.dispatchEvent(
      new CustomEvent("thinkabell-consent", { detail: { state } })
    );
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ConsentContext.Provider value={{ consent, setConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    return { consent: "none" as ConsentState, setConsent: () => {} };
  }
  return context;
}
