"use client";

import React from "react";
import { Clock } from "lucide-react";

interface PriceFreshnessBadgeProps {
  updatedAt: string;
}

export function PriceFreshnessBadge({ updatedAt }: PriceFreshnessBadgeProps) {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let label: string;
  if (diffHours < 1) {
    label = "Verified just now";
  } else if (diffHours < 24) {
    label = `Verified ${diffHours}h ago`;
  } else if (diffDays === 1) {
    label = "Verified yesterday";
  } else if (diffDays < 7) {
    label = `Verified ${diffDays} days ago`;
  } else {
    label = `Verified ${diffDays} days ago`;
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <Clock className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}
