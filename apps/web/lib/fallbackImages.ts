import type { ProductCategory } from "@thinkabell/shared";

const FALLBACK_IMAGE_BASE_URLS: Record<ProductCategory, string> = {
  physical: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
  software: "https://images.unsplash.com/photo-1555066931-4365d14bab8c",
};

export function fallbackImageUrl(
  category: ProductCategory,
  width = 800,
): string {
  const baseUrl = FALLBACK_IMAGE_BASE_URLS[category];
  return `${baseUrl}?auto=format&fit=crop&w=${width}&q=80`;
}
