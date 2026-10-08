"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface DealCountdownProps {
  endDate: string;
}

export function DealCountdown({ endDate }: DealCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endDate).getTime() - Date.now();

      if (difference <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);

      setTimeLeft(parts.join(" ") || "Less than 1m");
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);

    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800" aria-live="polite" aria-label={`Deal ends in ${timeLeft}`}>
      <Clock className="h-3.5 w-3.5" />
      <span>Ends in {timeLeft}</span>
    </div>
  );
}
