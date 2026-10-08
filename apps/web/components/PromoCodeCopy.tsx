"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface PromoCodeCopyProps {
  code: string;
}

export function PromoCodeCopy({ code }: PromoCodeCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5">
        <p className="text-xs text-gray-500 mb-0.5">Promo Code</p>
        <p className="text-sm font-mono font-bold text-gray-900">{code}</p>
      </div>
      <button
        onClick={handleCopy}
        aria-live="polite"
        className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
