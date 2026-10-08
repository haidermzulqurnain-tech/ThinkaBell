import type { Metadata } from "next";
import AlertsPageClient from "./AlertsPageClient";

export const metadata: Metadata = {
  title: "Manage Deal Alert Preferences | ThinkaBell",
  description:
    "Manage your ThinkaBell price alert preferences, discount thresholds, do-not-disturb hours, and digest frequency.",
  alternates: { canonical: "/alerts" },
};

export default function AlertsPage() {
  return <AlertsPageClient />;
}
