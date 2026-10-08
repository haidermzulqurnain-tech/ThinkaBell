"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Scale, X } from "lucide-react";
import { useCompare } from "./CompareProvider";

export function CompareBar() {
  const { slugs, clear } = useCompare();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(slugs.length > 0);
  }, [slugs.length]);

  if (!visible || pathname === "/compare") {
    return null;
  }

  const href = `/compare?slugs=${encodeURIComponent(slugs.join(","))}`;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full bg-gray-900 py-2.5 pl-5 pr-3 text-white shadow-xl">
        <span className="text-sm font-medium">
          {slugs.length} product{slugs.length === 1 ? "" : "s"} selected
        </span>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <Scale className="h-4 w-4" />
          Compare Now
        </Link>
        <button
          type="button"
          onClick={clear}
          aria-label="Clear comparison selection"
          className="rounded-full p-2 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}