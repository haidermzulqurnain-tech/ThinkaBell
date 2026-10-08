import { getSupabaseServiceClient, getSupabaseAnonClient } from "../client";
import type { RetailerLinkRow, RetailerType } from "../types";

export class RetailerLinkRepository {
  static async getLinksForProduct(productId: number): Promise<RetailerLinkRow[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("retailer_links")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      console.error(`[RetailerLinkRepository] Error fetching links for product ${productId}:`, error.message);
      return [];
    }

    return (data ?? []) as RetailerLinkRow[];
  }

  static async upsertLink(
    productId: number,
    retailer: RetailerType,
    affiliateUrl: string,
    isSponsored = false,
  ): Promise<RetailerLinkRow> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("retailer_links")
      .upsert(
        {
          product_id: productId,
          retailer,
          affiliate_url: affiliateUrl,
          is_sponsored: isSponsored,
        },
        { onConflict: "product_id,retailer" },
      )
      .select()
      .single();

    if (error) {
      console.error(`[RetailerLinkRepository] Failed to upsert link for product ${productId}:`, error.message);
      throw error;
    }

    return data as RetailerLinkRow;
  }

  static async incrementClickCount(linkId: number): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("increment_retailer_click", { link_id: linkId });

    if (error) {
      // Fallback: fetch current value, increment, and update
      const { data: link } = await supabase
        .from("retailer_links")
        .select("click_count")
        .eq("id", linkId)
        .single();

      if (link) {
        const { error: updateError } = await supabase
          .from("retailer_links")
          .update({ click_count: (link as { click_count: number }).click_count + 1 })
          .eq("id", linkId);

        if (updateError) {
          console.error(`[RetailerLinkRepository] Failed to increment click for link ${linkId}:`, updateError.message);
          throw updateError;
        }
      }
    }
  }

  static async getSponsoredLinksForProducts(productIds: number[]): Promise<RetailerLinkRow[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("retailer_links")
      .select("*")
      .in("product_id", productIds)
      .eq("is_sponsored", true);

    if (error) {
      console.error("[RetailerLinkRepository] Error fetching sponsored links:", error.message);
      return [];
    }

    return (data ?? []) as RetailerLinkRow[];
  }
}
