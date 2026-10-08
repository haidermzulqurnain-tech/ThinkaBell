import type { Metadata } from "next";
import SubscribePageClient from "./SubscribePageClient";

export const metadata: Metadata = {
  title: "Subscribe to Deal Alerts | ThinkaBell",
  description:
    "Create free deal alerts on ThinkaBell and get notified the moment AI gadgets, smart home devices, or software tools drop in price.",
  alternates: { canonical: "/subscribe" },
};

export default function SubscribePage() {
  return <SubscribePageClient />;
}
