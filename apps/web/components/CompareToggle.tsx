"use client";

import React from "react";
import { Scale } from "lucide-react";
import { useCompare } from "./CompareProvider";
import { trackEvent } from "../lib/posthog";

interface CompareToggleProps {
  slug: string;
  name: string;
}

export function CompareToggle({ slug, name }: CompareToggleProps) {
  const { isInCompare, toggle, slugs } = useCompare();
  const active = isInCompare(slug);
  const isFull = !active && slugs.length >= 4;

  const handleClick = () => {
    if (isFull) return;
    trackEvent("compare_toggle_product", {
      slug,
      name,
      action: active ? "removed" : "added",
    });
    toggle(slug);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isFull}
      aria-pressed={active}
      title={
        isFull
          ? "Compare list is full (max 4)"
          : active
            ? "Remove from comparison"
            : "Add to comparison"
      }
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[44px] ${
        active
          ? "bg-purple-600 text-white hover:bg-purple-700"
          : isFull
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white"
      }`}
    >
      <Scale className="h-3.5 w-3.5" />
      <span>{active ? "In Compare" : "Compare"}</span>
    </button>
  );
}