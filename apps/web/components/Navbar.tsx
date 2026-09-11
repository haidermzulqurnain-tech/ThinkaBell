import Link from "next/link";
import { Bell, Flame, Laptop, Zap } from "lucide-react";

export function Navbar() {
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
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/subscribe"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span>Get Price Alerts</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
