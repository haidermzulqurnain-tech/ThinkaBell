import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useParams: () => ({}),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock Next Image
vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: any) => {
    const { toHaveAttribute } = require("@testing-library/jest-dom");
    return {
      type: "img",
      props: { alt, src, ...props },
    };
  },
}));

// Mock Next Script
vi.mock("next/script", () => ({
  default: ({ children, ...props }: any) => ({
    type: "script",
    props: { ...props, children },
  }),
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  Bell: () => "Bell",
  Flame: () => "Flame",
  ShieldCheck: () => "ShieldCheck",
  Sparkles: () => "Sparkles",
  Zap: () => "Zap",
  Laptop: () => "Laptop",
  ArrowLeft: () => "ArrowLeft",
  ArrowUpRight: () => "ArrowUpRight",
  ExternalLink: () => "ExternalLink",
  Tag: () => "Tag",
  TrendingDown: () => "TrendingDown",
  CheckCircle2: () => "CheckCircle2",
  Info: () => "Info",
  Clock: () => "Clock",
  Copy: () => "Copy",
  AlertCircle: () => "AlertCircle",
  Scale: () => "Scale",
  Trophy: () => "Trophy",
  X: () => "X",
  Menu: () => "Menu",
  Search: () => "Search",
  AlertTriangle: () => "AlertTriangle",
}));

// Suppress expected console errors in tests
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("Warning: ") ||
      args[0].includes("not wrapped in act") ||
      args[0].includes("An update to") ||
      args[0].includes("React Hook Form"))
  ) {
    return;
  }
  originalError.call(console, ...args);
};