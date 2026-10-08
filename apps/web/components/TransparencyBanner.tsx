"use client";

import React from "react";
import { Info } from "lucide-react";

interface TransparencyBannerProps {
  dealType?: string;
}

export function TransparencyBanner({ dealType }: TransparencyBannerProps) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shrink-0">
        <Info className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-bold text-blue-900">
          {dealType === "promo" ? "Promotional Pricing" : "Price Transparency"}
        </p>
        <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
          {dealType === "promo"
            ? "This is a limited-time promotional price. We track the regular price and any price changes during the promotion period."
            : "We display the lowest verified price we have tracked for this product. Prices and availability change frequently."}
        </p>
      </div>
    </div>
  );
}
