import type { ProductCategory, SubscriptionTier, DigestFrequency, RetailerType } from "@thinkabell/database";

export type { ProductCategory, SubscriptionTier, DigestFrequency, RetailerType };

export interface Product {
  id: number;
  user_id?: string | null;
  name: string;
  slug: string;
  category: ProductCategory;
  brand?: string | null;
  amazon_asin?: string | null;
  ebay_epid?: string | null;
  walmart_sku?: string | null;
  affiliate_links: Record<string, string>;
  current_price?: number | null;
  previous_price?: number | null;
  price_updated_at?: string | null;
  image_url?: string | null;
  description?: string | null;
  tags: string[];
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  deal_type?: string | null;
  promo_code?: string | null;
  deal_end_date?: string | null;
}

export interface Subscriber {
  id: number;
  user_id?: string | null;
  email: string;
  push_subscription_id?: string | null;
  preferences: {
    categories?: ProductCategory[];
    min_discount?: number;
    [key: string]: unknown;
  };
  is_active?: boolean;
  dnd_enabled?: boolean;
  dnd_start?: string | null;
  dnd_end?: string | null;
  digest_frequency?: DigestFrequency;
  subscription_tier?: SubscriptionTier;
  trial_ends_at?: string | null;
  last_notified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  product_id: number;
  subscriber_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  created_at: string;
  sent: boolean;
  attempts?: number;
  last_error?: string | null;
  scheduled_for?: string;
  is_dead_letter?: boolean;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  source: string;
  recorded_at: string;
}

export interface RetailerLink {
  id: number;
  product_id: number;
  retailer: RetailerType;
  affiliate_url: string;
  is_sponsored: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClickTracking {
  id: number;
  retailer_link_id: number;
  subscriber_id?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  clicked_at: string;
}

export interface DeadLetter {
  id: number;
  alert_queue_id: number;
  product_id: number;
  subscriber_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  last_error?: string | null;
  attempts: number;
  created_at: string;
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
