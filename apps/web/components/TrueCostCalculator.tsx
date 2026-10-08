"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";

interface TrueCostCalculatorProps {
  dealPrice: number;
  dealName: string;
  description?: string;
}

export function TrueCostCalculator({ dealPrice, dealName, description }: TrueCostCalculatorProps) {
  const [hiddenFees, setHiddenFees] = useState("");
  const [setupCost, setSetupCost] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [months, setMonths] = useState("12");

  const hiddenFeesNum = parseFloat(hiddenFees) || 0;
  const setupCostNum = parseFloat(setupCost) || 0;
  const monthlyCostNum = parseFloat(monthlyCost) || 0;
  const monthsNum = parseInt(months) || 12;

  const totalCost = dealPrice + hiddenFeesNum + setupCostNum + monthlyCostNum * monthsNum;
  const monthlyEquivalent = totalCost / monthsNum;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <Calculator className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">True Cost Calculator</h3>
          <p className="text-xs text-gray-500">Estimate the total cost of ownership</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Deal Price
          </label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="text-sm font-bold text-gray-900">${dealPrice.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Hidden Fees (taxes, shipping, etc.)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={hiddenFees}
            onChange={(e) => setHiddenFees(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            One-Time Setup Cost
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={setupCost}
            onChange={(e) => setSetupCost(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Monthly Recurring Cost
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Time Period (months)
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
          <span className="text-xs font-semibold text-blue-900">Total Cost ({monthsNum} months)</span>
          <span className="text-lg font-black text-blue-900">${totalCost.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-xs font-semibold text-gray-700">Monthly Equivalent</span>
          <span className="text-lg font-black text-gray-900">${monthlyEquivalent.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-1.5 text-[11px] text-gray-500">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          This calculator provides an estimate only. Actual costs may vary based on usage, taxes, and additional services.
        </span>
      </div>
    </div>
  );
}
