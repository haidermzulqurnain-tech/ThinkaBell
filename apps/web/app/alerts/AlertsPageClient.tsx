"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Mail, Settings2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AlertQualityScore } from "@/components/AlertQualityScore";

type SubscriberData = {
  id: number;
  email: string;
  preferences: {
    categories?: string[];
    min_discount?: number;
    [key: string]: unknown;
  };
  dnd_enabled: boolean;
  dnd_start: string | null;
  dnd_end: string | null;
  digest_frequency: string;
  created_at: string;
};

type AlertData = {
  id: number;
  product_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  sent: boolean;
  attempts: number;
  last_error: string | null;
  created_at: string;
  alert_quality_score: number | null;
};

export default function AlertsPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscriber, setSubscriber] = useState<SubscriberData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editMinDiscount, setEditMinDiscount] = useState(10);
  const [editFrequency, setEditFrequency] = useState("immediate");
  const [editDndEnabled, setEditDndEnabled] = useState(false);
  const [editDndStart, setEditDndStart] = useState("");
  const [editDndEnd, setEditDndEnd] = useState("");

  const lookupSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setNotFound(false);
    setSubscriber(null);
    setAlerts([]);

    try {
      const res = await fetch(`/api/alerts?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to lookup subscription.");
        return;
      }

      if (!data.found) {
        setNotFound(true);
        return;
      }

      setSubscriber(data.subscriber);
      setAlerts(data.alerts || []);
      setEditCategories(data.subscriber.preferences?.categories || ["physical", "software"]);
      setEditMinDiscount(data.subscriber.preferences?.min_discount || 10);
      setEditFrequency(data.subscriber.digest_frequency || "immediate");
      setEditDndEnabled(data.subscriber.dnd_enabled || false);
      setEditDndStart(data.subscriber.dnd_start || "");
      setEditDndEnd(data.subscriber.dnd_end || "");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriber) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: subscriber.email,
          preferences: {
            categories: editCategories,
            min_discount: editMinDiscount,
          },
          digest_frequency: editFrequency,
          dnd_enabled: editDndEnabled,
          dnd_start: editDndEnabled ? editDndStart || null : null,
          dnd_end: editDndEnabled ? editDndEnd || null : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update preferences.");
        return;
      }

      setSuccess("Preferences updated successfully.");
      setSubscriber({
        ...subscriber,
        preferences: data.data.preferences,
        digest_frequency: data.data.digest_frequency,
        dnd_enabled: data.data.dnd_enabled,
        dnd_start: data.data.dnd_start,
        dnd_end: data.data.dnd_end,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-extrabold text-gray-900">Alert Preferences</h1>
        </div>
        <p className="text-sm text-gray-500">
          Manage your price alert subscriptions, notification frequency, and do-not-disturb settings.
        </p>
      </div>

      {!subscriber && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Find Your Subscription</h2>
          <form onSubmit={lookupSubscriber} className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Looking up..." : "Look Up"}
            </button>
          </form>

          {notFound && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-800">
                No subscription found for that email.{" "}
                <Link href="/subscribe" className="font-semibold underline">
                  Subscribe to alerts
                </Link>{" "}
                to get started.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      )}

      {subscriber && (
        <div className="space-y-6">
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-emerald-800">{success}</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
            </div>

            <form onSubmit={updatePreferences} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Categories
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editCategories.includes("physical")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditCategories([...editCategories, "physical"]);
                        } else {
                          setEditCategories(editCategories.filter((c) => c !== "physical"));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm text-gray-700">Physical Gadgets</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editCategories.includes("software")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditCategories([...editCategories, "software"]);
                        } else {
                          setEditCategories(editCategories.filter((c) => c !== "software"));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm text-gray-700">Software & SaaS</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minimum Discount: {editMinDiscount}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="99"
                  value={editMinDiscount}
                  onChange={(e) => setEditMinDiscount(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span>99%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Digest Frequency
                </label>
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value="immediate">Immediate</option>
                  <option value="hourly">Hourly Digest</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Do Not Disturb
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditDndEnabled(!editDndEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editDndEnabled ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        editDndEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {editDndEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={editDndStart}
                        onChange={(e) => setEditDndStart(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={editDndEnd}
                        onChange={(e) => setEditDndEnd(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Save Preferences"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubscriber(null);
                    setEmail("");
                    setAlerts([]);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Look Up Different Email
                </button>
              </div>
            </form>
          </div>

          {alerts.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Alerts</h2>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Price dropped from ${alert.old_price.toFixed(2)} to ${alert.new_price.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {alert.discount_percent.toFixed(1)}% off • {new Date(alert.created_at).toLocaleDateString()}
                      </p>
                      {typeof alert.alert_quality_score === "number" && (
                        <div className="mt-2">
                          <AlertQualityScore score={Math.min(100, Math.max(0, alert.alert_quality_score))} />
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        alert.sent
                          ? "bg-emerald-100 text-emerald-800"
                          : alert.attempts > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {alert.sent ? "Sent" : alert.attempts > 0 ? `Retrying (${alert.attempts})` : "Queued"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
