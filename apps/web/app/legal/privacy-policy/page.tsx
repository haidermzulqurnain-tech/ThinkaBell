import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ThinkaBell",
  description: "ThinkaBell privacy policy and data handling practices",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-600">Last updated: September 2026</p>

        <div className="mt-8 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Information We Collect</h2>
            <p className="mt-2">
              We collect email addresses and push subscription identifiers when you subscribe to price drop alerts.
              We also collect price tracking data for products you follow, including price history and retailer links.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. How We Use Your Information</h2>
            <p className="mt-2">
              Your information is used solely to deliver price drop alerts and improve our service.
              We do not sell or share your personal data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Data Retention</h2>
            <p className="mt-2">
              We retain your subscription data for as long as your account is active or as needed to provide services.
              Price history data is retained for 2 years. You may request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Cookies and Tracking</h2>
            <p className="mt-2">
              We use essential cookies for site functionality and analytics cookies to understand usage patterns.
              You can manage cookie preferences through your browser settings or our cookie consent banner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Third-Party Services</h2>
            <p className="mt-2">
              We use third-party services including Supabase (database), OneSignal (push notifications),
              Brevo (email), and analytics providers. These services have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Your Rights</h2>
            <p className="mt-2">
              You have the right to access, correct, or delete your personal data.
              You may unsubscribe from alerts at any time using the link in any email we send.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Contact Us</h2>
            <p className="mt-2">
              For privacy-related inquiries, contact us at privacy@thinkabell.click
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
