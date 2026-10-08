import { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Bell, Zap, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About ThinkaBell | Real-Time Deal Alerts & Price Tracking",
  description: "Learn about ThinkaBell's mission to help shoppers never miss a price drop on AI hardware, smart gadgets, and software tools.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            About ThinkaBell
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            We believe everyone deserves access to the best deals on the tech they love.
            ThinkaBell monitors prices 24/7 so you can buy with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 mb-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Verified Affiliate Links</h3>
            <p className="text-sm text-gray-600">
              Every link on ThinkaBell is properly disclosed and tagged. We never override cookies
              or accept pay-for-play placements. Our recommendations are based on real price data.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Real-Time Alerts</h3>
            <p className="text-sm text-gray-600">
              We scan prices across multiple retailers on a fixed schedule. When a deal matches your
              criteria, you get an instant push notification or email — no checking required.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">SaaS-First Focus</h3>
            <p className="text-sm text-gray-600">
              While we track physical gadgets, our real passion is software deals. Lifetime licenses,
              subscription bundles, and promo codes for developer tools — curated and verified.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Community-Driven</h3>
            <p className="text-sm text-gray-600">
              ThinkaBell is built for deal hunters, by deal hunters. Our community helps surface
              great deals, report pricing errors, and keep our data accurate.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <div className="space-y-4 text-gray-700">
            <p>
              ThinkaBell was built to solve a simple problem: finding the right deal at the right time
              shouldn&apos;t require constant monitoring across dozens of websites.
            </p>
            <p>
              We combine automated price tracking with manual curation to surface deals that are
              actually worth your attention. Every product is verified, every link is disclosed, and
              every alert is sent with your preferences in mind.
            </p>
            <p>
              We&apos;re starting with a tight focus on AI hardware, developer tools, and SaaS software —
              categories where price drops matter most and commissions are transparent.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all"
          >
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  );
}
