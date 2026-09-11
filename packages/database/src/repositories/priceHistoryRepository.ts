import { getSupabaseAnonClient, getSupabaseServiceClient } from "../client";
import type { PriceHistoryRow } from "../types";

export class PriceHistoryRepository {
  /**
   * Fetch historical price points for a product, sorted chronologically
   */
  static async getHistoryForProduct(productId: number, limit = 50): Promise<PriceHistoryRow[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("recorded_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error(`[PriceHistoryRepository] Error fetching history for product ${productId}:`, error.message);
      return [];
    }

    return (data ?? []) as PriceHistoryRow[];
  }

  /**
   * Record a new price snapshot for a product
   */
  static async recordPrice(
    productId: number,
    price: number,
    source: "amazon" | "ebay" | "direct",
  ): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("price_history").insert({
      product_id: productId,
      price,
      source,
      recorded_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[PriceHistoryRepository] Failed to record price for product ${productId}:`, error.message);
      throw error;
    }
  }
}
