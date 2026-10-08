export interface DiscoveredProduct {
  sourceId: string;
  source: "ebay" | "walmart" | "partnerstack" | "appsumo" | "impact" | "amazon-list";
  /** ASIN for Amazon products; enables price tracking and geo-routed CTAs. */
  amazonAsin?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  category?: string;
  url: string;
  affiliateUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductSource {
  name: string;
  type: "physical" | "software";
  search(query: string, limit?: number): Promise<DiscoveredProduct[]>;
  getPrice(sourceId: string): Promise<number | null>;
  getProductDetails(sourceId: string): Promise<DiscoveredProduct | null>;
}

export interface DiscoveryResult {
  source: string;
  query: string;
  products: DiscoveredProduct[];
  error?: string;
}
