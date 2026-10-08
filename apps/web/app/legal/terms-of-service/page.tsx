import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ThinkaBell",
  description: "ThinkaBell terms of service and usage agreement",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-600">Last updated: September 2026</p>

        <div className="mt-8 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using ThinkaBell, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Service Description</h2>
            <p className="mt-2">
              ThinkaBell provides price tracking and deal alert services.
              We monitor product prices across various retailers and notify you of price drops.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. User Responsibilities</h2>
            <p className="mt-2">
              You are responsible for maintaining the confidentiality of your account information
              and for all activities that occur under your account. You agree not to use the service
              for any unlawful purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Affiliate Disclosure</h2>
            <p className="mt-2">
              ThinkaBell participates in affiliate programs including Amazon Associates, eBay Partner Network,
              and Walmart Affiliate Program. We may earn commissions from qualifying purchases made through our links.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Limitation of Liability</h2>
            <p className="mt-2">
              ThinkaBell is provided &quot;as is&quot; without warranties of any kind.
              We are not liable for any indirect, incidental, special, or consequential damages
              arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Changes to Terms</h2>
            <p className="mt-2">
              We reserve the right to modify these terms at any time. Continued use of the service
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Contact</h2>
            <p className="mt-2">
              For questions about these terms, contact us at legal@thinkabell.click
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
