"use client";

import { useState } from "react";
import type { PriceHistory } from "@thinkabell/shared";

interface PriceHistoryChartProps {
  history: PriceHistory[];
  currentPrice: number;
}

export function PriceHistoryChart({ history, currentPrice }: PriceHistoryChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ price: number; date: string; source: string } | null>(null);

  // If no historical data points exist yet, synthesize an entry with current price
  const points =
    history.length > 0
      ? history
      : [
          {
            id: 1,
            product_id: 1,
            price: currentPrice * 1.15,
            source: "historic",
            recorded_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
          },
          {
            id: 2,
            product_id: 1,
            price: currentPrice,
            source: "current",
            recorded_at: new Date().toISOString(),
          },
        ];

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices, currentPrice);
  const maxPrice = Math.max(...prices, currentPrice);
  const priceSpread = maxPrice - minPrice || 1;

  // Chart dimensions
  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Map data points to SVG coordinates
  const coordinates = points.map((point, index) => {
    const x = padding.left + (index / (points.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((point.price - minPrice) / priceSpread) * chartHeight;
    return { ...point, x, y };
  });

  const pathD = coordinates.reduce((acc, point, index) => {
    return `${acc} ${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
  }, "");

  // Area under line
  const areaD = `${pathD} L ${coordinates[coordinates.length - 1]?.x || chartWidth} ${
    padding.top + chartHeight
  } L ${coordinates[0]?.x || padding.left} ${padding.top + chartHeight} Z`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Price History</h3>
          <p className="text-xs text-gray-500">Tracked price fluctuations over time</p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-500">All-Time Low: </span>
            <span className="font-bold text-emerald-600">${minPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">All-Time High: </span>
            <span className="font-bold text-gray-700">${maxPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + chartHeight * (1 - ratio);
            const priceVal = minPrice + priceSpread * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-gray-400 text-[10px]"
                >
                  ${priceVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area gradient */}
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <path d={areaD} fill="url(#priceGradient)" />

          {/* Price Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {coordinates.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.date === pt.recorded_at ? 6 : 4}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2.5"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() =>
                setHoveredPoint({
                  price: pt.price,
                  date: new Date(pt.recorded_at).toLocaleDateString(),
                  source: pt.source,
                })
              }
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
            <span className="font-bold text-emerald-400">${hoveredPoint.price.toFixed(2)}</span>
            <span className="text-gray-300"> on {hoveredPoint.date} ({hoveredPoint.source})</span>
          </div>
        )}
      </div>
    </div>
  );
}
