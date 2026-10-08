import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { trackEvent } from "../lib/posthog";

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productSlug?: string;
}

export function SubscribeModal({ isOpen, onClose, productSlug }: SubscribeModalProps) {
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<string[]>(["physical", "software"]);
  const [minDiscount, setMinDiscount] = useState<number>(10);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
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
          preferences: {
            categories,
            min_discount: minDiscount,
            product_slug: productSlug,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Subscription failed");
      }

      setStatus("success");
      trackEvent("subscription_successful", { email, minDiscount, categories, productSlug });
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setStatus("idle");
    setErrorMessage("");
  };

  const handleClose = useCallback(() => {
    onClose();
    setStep(1);
    setStatus("idle");
    setErrorMessage("");
    setEmail("");
    setCategories(["physical", "software"]);
    setMinDiscount(10);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const modal = document.querySelector("[role=\"dialog\"]");
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1] as HTMLElement;
    const handleTab = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key !== "Tab") return;
      if (keyboardEvent.shiftKey) {
        if (document.activeElement === first) {
          keyboardEvent.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          keyboardEvent.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };
    modal.addEventListener("keydown", handleTab as EventListener);
    first?.focus();
    return () => modal.removeEventListener("keydown", handleTab as EventListener);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You are on the alert list!</h2>
            <p className="text-sm text-gray-600 mb-6">
              We have activated deal monitoring for <strong>{email}</strong>.
              {productSlug && " We will notify you when this deal changes."}
            </p>
            <button
              onClick={handleClose}
              className="inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Continue Browsing
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Bell className="h-5 w-5" />
                </div>
                  <div>
                    <h2 id="modal-title" className="text-xl font-bold text-gray-900">Get Deal Alerts</h2>
                    <p className="text-xs text-gray-500">
                      {productSlug ? "Get notified when this deal changes" : "Track prices and never miss a drop"}
                    </p>
                  </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`h-1.5 flex-1 rounded-full ${step === 1 ? "bg-blue-600" : "bg-blue-600"}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-blue-600" : "bg-gray-200"}`} />
              <span className="text-[11px] text-gray-500 ml-2">Step {step} of 2</span>
            </div>

            {step === 1 ? (
              <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                {errorMessage && (
                  <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 mb-4">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-4">
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

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      What do you want to track?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCategory("physical")}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                          categories.includes("physical")
                            ? "border-blue-600 bg-blue-50/50 text-blue-900"
                            : "border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${categories.includes("physical") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                          <Bell className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold">Physical</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCategory("software")}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                          categories.includes("software")
                            ? "border-blue-600 bg-blue-50/50 text-blue-900"
                            : "border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${categories.includes("software") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold">Software</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!email || categories.length === 0}
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <span>Continue</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                {errorMessage && (
                  <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 mb-4">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Minimum Discount
                      </label>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                        {minDiscount}% off
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
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>5%</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-blue-900 mb-1">We respect your inbox</p>
                        <p className="text-[11px] text-blue-700">
                          Unsubscribe with one click anytime. No spam, just deals.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{status === "loading" ? "Activating..." : "Start Tracking"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
