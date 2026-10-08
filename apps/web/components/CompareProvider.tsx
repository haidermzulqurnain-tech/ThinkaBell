"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "thinkabell-compare";
const MAX_COMPARE_ITEMS = 4;

interface CompareContextValue {
  slugs: string[];
  isInCompare: (slug: string) => boolean;
  toggle: (slug: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readStored());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // Storage unavailable (private mode) — keep in-memory state only
    }
  }, [slugs]);

  const toggle = useCallback((slug: string) => {
    setSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug].slice(-MAX_COMPARE_ITEMS);
    });
  }, []);

  const clear = useCallback(() => setSlugs([]), []);

  const isInCompare = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const value = useMemo(
    () => ({ slugs, isInCompare, toggle, clear }),
    [slugs, isInCompare, toggle, clear],
  );

  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return ctx;
}