import type { ProductCategory } from "@thinkabell/database";

export type { ProductCategory };

export interface Product {
  id: number;
  name: string;
  slug: string;
  category: ProductCategory;
  brand?: string | null;
  amazon_asin?: string | null;
  ebay_epid?: string | null;
  affiliate_links: Record<string, string>;
  current_price?: number | null;
  previous_price?: number | null;
  price_updated_at?: string | null;
  image_url?: string | null;
  description?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Subscriber {
  id: number;
  email: string;
  push_subscription_id?: string | null;
  preferences: {
    categories?: ProductCategory[];
    min_discount?: number;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface Alert {
  id: number;
  product_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  created_at: string;
  sent: boolean;
  attempts?: number;
  last_error?: string | null;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  source: string;
  recorded_at: string;
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  url: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
}

export interface EmailNotificationPayload {
  subject: string;
  body: string;
  html?: string;
  recipientEmail?: string;
  productName?: string;
  dealUrl?: string;
  discountPercent?: number;
  currentPrice?: number;
  previousPrice?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}
