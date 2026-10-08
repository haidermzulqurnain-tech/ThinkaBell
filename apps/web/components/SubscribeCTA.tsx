"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { trackEvent } from "../lib/posthog";
import { SubscribeModal } from "./SubscribeModal";

export function SubscribeCTA() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const product = searchParams.get("product");
    if (product) {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const openModal = () => {
    setIsModalOpen(true);
    trackEvent("subscribe_cta_clicked", { source: "homepage" });
  };

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 sm:p-12 text-center">
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20 text-white mb-4">
              <Bell className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Never Miss a Deal Again
            </h2>
            <p className="text-sm sm:text-base text-blue-100 max-w-2xl mx-auto mb-6">
              Get instant email and push notifications when prices drop on the products you care about.
              Track Amazon, eBay, and SaaS deals in real-time.
            </p>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Enable Free Alerts</span>
            </button>
            <div className="mt-6 flex flex-wrap justify-center items-center gap-6 text-xs text-blue-100">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>Zero spam</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Unsubscribe anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SubscribeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productSlug={searchParams.get("product") || undefined}
      />
    </>
  );
}
