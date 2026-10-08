import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getNonce } from "../../lib/csp";

const faqs = [
  {
    question: "How often do you check prices?",
    answer:
      "We check prices on a fixed schedule for all tracked products to ensure you get the most current pricing information.",
  },
  {
    question: "Are your affiliate links trustworthy?",
    answer:
      "Yes. All affiliate links are verified and disclosed. We earn a commission on purchases through our links, which helps keep the service free.",
  },
  {
    question: "How do I get deal alerts?",
    answer:
      "Click 'Get Price Alerts', enter your email, choose categories, and set your minimum discount threshold. We'll notify you when prices drop.",
  },
  {
    question: "Do you track SaaS and software deals?",
    answer:
      "Yes. We track software subscriptions, lifetime deals, and promo codes from platforms like AppSumo, PartnerStack, and Impact.",
  },
  {
    question: "How accurate is the True Cost Calculator?",
    answer:
      "The calculator estimates total cost of ownership including subscriptions, taxes, and opportunity cost. Actual costs may vary.",
  },
  {
    question: "Can I unsubscribe from alerts?",
    answer:
      "Yes. Every email includes a one-click unsubscribe link, and you can manage preferences from your account settings.",
  },
];

export const metadata = {
  title: "Frequently Asked Questions | ThinkaBell",
  description: "Answers to common questions about ThinkaBell price tracking, alerts, and affiliate links.",
};

export default async function FAQPage() {
  const nonce = await getNonce();
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">FAQ</span>
      </nav>

      <h1 className="text-3xl font-black text-gray-900 mb-8">Frequently Asked Questions</h1>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-bold text-gray-900 mb-2">{faq.question}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50/70 p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Still have questions?</h2>
        <p className="text-sm text-gray-600 mb-4">
          We are here to help. Reach out and we will get back to you within 24 hours.
        </p>
        <Link
          href="/subscribe"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
        >
          Get Deal Alerts
        </Link>
      </div>
    </div>
  );
}
