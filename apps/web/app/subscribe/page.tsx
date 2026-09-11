"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Laptop, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { trackEvent } from "../../lib/posthog";

interface OneSignalUser {
  pushSubscription?: {
    id?: string;
  };
}

interface OneSignalInstance {
  push: (cb: () => void | Promise<void>) => void;
  showSlidedownPrompt: () => Promise<void>;
  User?: OneSignalUser;
}

declare global {
  interface Window {
    OneSignal?: OneSignalInstance;
  }
}

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<string[]>(["physical", "software"]);
  const [minDiscount, setMinDiscount] = useState<number>(10);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSubscriptionId, setPushSubscriptionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleEnablePush = () => {
    if (typeof window !== "undefined" && window.OneSignal) {
      window.OneSignal.push(async () => {
        try {
          await window.OneSignal?.showSlidedownPrompt();
          const pushId = window.OneSignal?.User?.pushSubscription?.id;
          if (pushId) {
            setPushSubscriptionId(pushId);
            setPushEnabled(true);
            trackEvent("push_permission_granted", { pushId });
          }
        } catch (err) {
          console.error("OneSignal prompt error:", err);
        }
      });
    } else {
      // Simulation mode in development
      const mockId = `mock-push-${Date.now()}`;
      setPushSubscriptionId(mockId);
      setPushEnabled(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          push_subscription_id: pushSubscriptionId,
          preferences: {
            categories,
            min_discount: minDiscount,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Subscription failed");
      }

      setStatus("success");
      trackEvent("subscription_successful", { email, minDiscount, categories });
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 mb-4">
          <Bell className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Get Instant Deal Alerts
        </h1>
        <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-md mx-auto">
          Choose the gadgets and software tools you want to monitor, and we will ping you the moment prices drop.
        </p>
      </div>

      {status === "success" ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">You are on the alert list!</h2>
          <p className="mt-2 text-sm text-gray-600">
            We have activated deal monitoring for <strong>{email}</strong>. We will notify you whenever prices drop by at least {minDiscount}%.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Update Preferences
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-6"
        >
          {errorMessage && (
            <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Email input */}
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Select Categories to Monitor
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => toggleCategory("physical")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  categories.includes("physical")
                    ? "border-blue-600 bg-blue-50/50 text-blue-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className={`p-2 rounded-lg ${categories.includes("physical") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  <Laptop className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">Physical Gadgets</p>
                  <p className="text-xs text-gray-500">Apple, Sony, Logitech gear</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleCategory("software")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  categories.includes("software")
                    ? "border-blue-600 bg-blue-50/50 text-blue-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className={`p-2 rounded-lg ${categories.includes("software") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">Software & SaaS</p>
                  <p className="text-xs text-gray-500">VPNs, Dev tools, Mac apps</p>
                </div>
              </button>
            </div>
          </div>

          {/* Minimum Discount Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Minimum Price Drop Threshold
              </label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                At least {minDiscount}% off
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={minDiscount}
              onChange={(e) => setMinDiscount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>5% (Any drop)</span>
              <span>25% (Major drop)</span>
              <span>50% (Clearance)</span>
            </div>
          </div>

          {/* Web Push Prompt */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Browser Push Notifications</p>
                <p className="text-[11px] text-gray-500">Get alerted instantly even if email is closed</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEnablePush}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                pushEnabled
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {pushEnabled ? "Push Enabled ✓" : "Enable Push"}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === "loading" || categories.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span>{status === "loading" ? "Activating Alerts..." : "Start Tracking Deals"}</span>
          </button>

          <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Zero spam. Unsubscribe with one click anytime.</span>
          </p>
        </form>
      )}
    </div>
  );
}
