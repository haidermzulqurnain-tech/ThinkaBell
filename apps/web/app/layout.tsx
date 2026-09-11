import type { Metadata } from "next";
import Script from "next/script";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PostHogProvider } from "../components/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkaBell | Real-Time Deal Alerts & Price Tracking",
  description: "Track price drops on AI hardware, smart gadgets, and software tools. Get instant alerts before deals expire.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://thinkabell.click"),
  openGraph: {
    title: "ThinkaBell | Real-Time Deal Alerts & Price Tracking",
    description: "Track price drops on AI hardware, smart gadgets, and software tools.",
    url: "https://thinkabell.click",
    siteName: "ThinkaBell",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ThinkaBell | Deal Alerts",
    description: "Instant price drop notifications on gadgets and software.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

  return (
    <html lang="en">
      <head>
        {/* OneSignal Web Push SDK */}
        <Script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async strategy="afterInteractive" />
        {oneSignalAppId && (
          <Script id="onesignal-init" strategy="afterInteractive">
            {`
              window.OneSignal = window.OneSignal || [];
              OneSignal.push(function() {
                OneSignal.init({
                  appId: "${oneSignalAppId}",
                  safari_web_id: "",
                  notifyButton: {
                    enable: true,
                  },
                });
              });
            `}
          </Script>
        )}
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased flex flex-col">
        <PostHogProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
