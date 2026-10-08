import { getSupabaseAnonClient } from "../client";
import type { ProductCategory, ProductRow } from "../types";

const MAX_COMPARABLE_SLUGS = 20;

export class ComparisonRepository {
  /**
   * Fetch products suitable for comparison by category.
   * Returns up to `limit` active products with prices.
   */
  static async getComparableProducts(category: ProductCategory, limit = 4): Promise<ProductRow[]> {
    const clampedLimit = Math.min(Math.max(limit, 1), 10);
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .eq("is_active", true)
      .not("current_price", "is", null)
      .order("price_updated_at", { ascending: false })
      .limit(clampedLimit);

    if (error) {
      console.error("[ComparisonRepository] Error fetching comparable products:", error.message);
      return [];
    }

    return (data ?? []) as ProductRow[];
  }

  /**
   * Fetch a comparison set by product slugs.
   * Useful for explicit compare pages or modal comparisons.
   */
  static async getBySlugs(slugs: string[]): Promise<ProductRow[]> {
    if (slugs.length === 0) {
      return [];
    }

    const capped = slugs.slice(0, MAX_COMPARABLE_SLUGS);
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("slug", capped)
      .eq("is_active", true)
      .not("current_price", "is", null);

    if (error) {
      console.error("[ComparisonRepository] Error fetching products by slug:", error.message);
      return [];
    }

    return (data ?? []) as ProductRow[];
  }
}
