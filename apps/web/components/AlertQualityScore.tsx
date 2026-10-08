"use client";

import React from "react";
import { AlertCircle, Info } from "lucide-react";

interface AlertQualityScoreProps {
  score: number;
}

export function AlertQualityScore({ score }: AlertQualityScoreProps) {
  const getLabel = (s: number): string => {
    if (s >= 80) return "High confidence";
    if (s >= 60) return "Good value";
    if (s >= 40) return "Fair deal";
    if (s >= 20) return "Marginal";
    return "Low confidence";
  };

  const getColor = (s: number): string => {
    if (s >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (s >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
    if (s >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
    if (s >= 20) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getBarColor = (s: number): string => {
    if (s >= 80) return "bg-emerald-500";
    if (s >= 60) return "bg-blue-500";
    if (s >= 40) return "bg-amber-500";
    if (s >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className={`rounded-2xl border p-4 ${getColor(score)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs font-bold">Alert Quality Score</span>
        </div>
        <span className="text-xs font-medium opacity-80">{getLabel(score)}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${getBarColor(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <span className="text-sm font-black tabular-nums">{score}</span>
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-[11px] opacity-80">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Score reflects discount depth, source reliability, and historical price accuracy.
          Higher scores indicate stronger deal confidence.
        </span>
      </div>
    </div>
  );
}
