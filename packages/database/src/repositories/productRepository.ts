import { getSupabaseAnonClient, getSupabaseServiceClient } from "../client";
import type { ProductRow } from "../types";

export class ProductRepository {
  /**
   * Fetch top deals sorted by discount percentage or most recent price drop
   */
  static async getTopDeals(limit = 20): Promise<ProductRow[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .not("current_price", "is", null)
      .order("price_updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[ProductRepository] Error fetching top deals:", error.message);
      return [];
    }

    return (data ?? []) as ProductRow[];
  }

  /**
   * Fetch a single product by its unique URL slug
   */
  static async getBySlug(slug: string): Promise<ProductRow | null> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`[ProductRepository] Error fetching product slug ${slug}:`, error.message);
      return null;
    }

    return (data as unknown as ProductRow) ?? null;
  }

  /**
   * Fetch all products configured with Amazon ASIN or eBay EPID for tracking
   */
  static async getTrackableProducts(): Promise<ProductRow[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or("amazon_asin.not.is.null,ebay_epid.not.is.null");

    if (error) {
      console.error("[ProductRepository] Error fetching trackable products:", error.message);
      throw error;
    }

    return (data ?? []) as ProductRow[];
  }

  /**
   * Update product prices and timestamps
   */
  static async updateProductPrice(
    productId: number,
    newPrice: number,
    previousPrice: number | null,
  ): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("products")
      .update({
        current_price: newPrice,
        previous_price: previousPrice,
        price_updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (error) {
      console.error(`[ProductRepository] Failed to update price for product ${productId}:`, error.message);
      throw error;
    }
  }
}
