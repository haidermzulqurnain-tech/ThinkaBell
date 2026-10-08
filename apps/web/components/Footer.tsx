import Link from "next/link";
import { Bell } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                <Bell className="h-4 w-4" />
              </span>
              <span className="text-lg font-black tracking-tight text-gray-900">
                Thinka<span className="text-blue-600">Bell</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-600 max-w-sm">
              Real-time price drop tracking and smart deal alerts for AI hardware, developer gear, and software tools.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Categories</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/?category=physical" className="hover:text-blue-600">
                  AI Hardware & Gadgets
                </Link>
              </li>
              <li>
                <Link href="/?category=software" className="hover:text-blue-600">
                  Developer & Productivity Software
                </Link>
              </li>
              <li>
                <Link href="/subscribe" className="hover:text-blue-600">
                  Alert Subscriptions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                <a href="/api/health" className="hover:text-blue-600">
                  System Health Probe
                </a>
              </li>
              <li>
                <Link href="/subscribe" className="hover:text-blue-600">
                  Web Push Registration
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Affiliate Disclosure:</strong> ThinkaBell is a reader-supported deal portal. When you purchase through links on our site, we may earn an affiliate commission at no additional cost to you. Amazon, the Amazon logo, and Amazon Associates are trademarks of Amazon.com, Inc. or its affiliates. eBay and the eBay logo are trademarks of eBay Inc.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            &copy; {new Date().getFullYear()} ThinkaBell (thinkabell.click). All rights reserved.
            <Link href="/legal/privacy-policy" className="ml-2 text-gray-500 hover:text-gray-600">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
