import type { Metadata } from "next";
import { headers } from "next/headers";
import { env } from "@thinkabell/config";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PostHogProvider } from "../components/PostHogProvider";
import { ConsentProvider } from "../components/ConsentProvider";
import { CookieConsent } from "../components/CookieConsent";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OneSignalGate } from "../components/OneSignalGate";
import { CompareProvider } from "../components/CompareProvider";
import { CompareBar } from "../components/CompareBar";
import { getNonce } from "../lib/csp";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkaBell | Real-Time Deal Alerts & Price Tracking",
  description: "Track price drops on AI hardware, smart gadgets, and software tools. Get instant alerts before deals expire.",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "x-default": "/",
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {},
  openGraph: {
    title: "ThinkaBell | Real-Time Deal Alerts & Price Tracking",
    description: "Track price drops on AI hardware, smart gadgets, and software tools.",
    url: env.NEXT_PUBLIC_APP_URL,
    siteName: "ThinkaBell",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ThinkaBell | Deal Alerts",
    description: "Instant price drop notifications on gadgets and software.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = await getNonce();
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ThinkaBell",
    url: baseUrl,
    description: "Real-time deal alerts and price tracking for AI hardware, smart gadgets, and software tools.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ConsentProvider>
          <PostHogProvider>
            <CompareProvider>
              <OneSignalGate />
              <ErrorBoundary>
                <Navbar />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <Footer />
              </ErrorBoundary>
              <CompareBar />
              <CookieConsent />
            </CompareProvider>
          </PostHogProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
