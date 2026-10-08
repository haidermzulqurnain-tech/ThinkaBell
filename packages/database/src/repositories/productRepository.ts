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
      .eq("is_active", true)
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

  /**
   * Upsert products discovered from external sources.
   * Uses source + source_id as the unique conflict key.
   */
  static async upsertDiscoveredProducts(
    products: Array<{
      sourceId: string;
      source: string;
      /** ASIN for Amazon-sourced products (persisted to amazon_asin). */
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
      type: "physical" | "software";
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<{ inserted: number; updated: number }> {
    if (products.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const supabase = getSupabaseServiceClient();
    const now = new Date().toISOString();
    const rows = products.map((product) => {
      const slug = `${product.source}-${product.sourceId}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const normalizedPrice = product.price;
      const affiliateLinks: Record<string, string> = {};

      if (product.affiliateUrl) {
        affiliateLinks[product.source] = product.affiliateUrl;
      }

      const allImages = [product.imageUrl, product.videoUrl, ...(product.images || [])].filter(
        (url): url is string => Boolean(url),
      );

      if (allImages.length > 0) {
        allImages.forEach((img, idx) => {
          affiliateLinks[`${product.source}-media-${idx}`] = img;
        });
      }

      return {
        name: product.name,
        slug,
        category: product.type,
        current_price: normalizedPrice,
        previous_price: normalizedPrice,
        price_updated_at: now,
        image_url: product.imageUrl || null,
        description: product.description || null,
        tags: product.category ? [product.category] : [],
        sources: [product.source],
        source_id: product.sourceId,
        discovery_source: product.source,
        amazon_asin: product.amazonAsin ?? null,
        last_discovered_at: now,
        is_active: true,
        images: allImages.length > 0 ? allImages : [],
        video_url: product.videoUrl || null,
        metadata: product.metadata || null,
        affiliate_links: affiliateLinks,
      };
    });

    const { error } = await (supabase
      .from("products")
      .upsert(rows, { onConflict: "source,source_id" }) as any);

    if (error) {
      console.error("[ProductRepository] Failed to upsert discovered products:", error.message);
      throw error;
    }

    return { inserted: rows.length, updated: 0 };
  }

  /**
   * Fetch related products for deal page cross-linking.
   * Returns products in the same category, excluding the current product.
   */
  static async getRelatedProducts(
    slug: string,
    category: string,
    limit = 6,
  ): Promise<ProductRow[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category as any)
      .neq("slug", slug)
      .not("current_price", "is", null)
      .order("price_updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[ProductRepository] Error fetching related products:", error.message);
      return [];
    }

    return (data ?? []) as ProductRow[];
  }
}
