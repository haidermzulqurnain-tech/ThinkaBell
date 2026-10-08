import type { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Contact ThinkaBell | Real-Time Deal Alerts & Price Tracking",
  description:
    "Get in touch with the ThinkaBell team for support, feature requests, or affiliate partnership inquiries.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
