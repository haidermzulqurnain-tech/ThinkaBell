"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Flame, Laptop, Scale, Search, Zap, Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
              <Bell className="h-5 w-5" />
            </span>
            <span className="text-xl font-black tracking-tight text-gray-900">
              Thinka<span className="text-blue-600">Bell</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
              <Flame className="h-4 w-4 text-orange-500" />
              Top Deals
            </Link>
            <Link href="/?category=physical" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
              <Laptop className="h-4 w-4 text-blue-500" />
              Physical Gadgets
            </Link>
            <Link href="/?category=software" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
              <Zap className="h-4 w-4 text-amber-500" />
              Software & SaaS
            </Link>
            <Link href="/compare" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
              <Scale className="h-4 w-4 text-purple-500" />
              Compare
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <form action="/search" method="get" className="hidden md:flex items-center">
            <input
              type="search"
              name="q"
              placeholder="Search deals..."
              className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              className="ml-2 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
          <Link
            href="/subscribe"
            className="hidden md:inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span>Get Price Alerts</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2.5 text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
              Top Deals
            </Link>
            <Link href="/?category=physical" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
              Physical Gadgets
            </Link>
            <Link href="/?category=software" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
              Software & SaaS
            </Link>
            <Link href="/compare" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
              Compare
            </Link>
            <Link href="/subscribe" className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
              Get Price Alerts
            </Link>
            <form action="/search" method="get" className="mt-2">
              <input
                type="search"
                name="q"
                placeholder="Search deals..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
