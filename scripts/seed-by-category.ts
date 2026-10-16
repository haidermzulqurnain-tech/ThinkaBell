/**
 * @file scripts/seed-by-category.ts
 * @description Dynamic category-driven product seeder.
 *
 * Seeds category anchor products into Supabase based on Amazon category
 * configuration. No products are hardcoded — categories and their browse
 * nodes drive discovery. Real products are populated by the discovery job
 * from curated Amazon Lists (AMAZON_LIST_URLS) or other sources.
 *
 * Each category anchor:
 *   - Has the category code as its name and slug prefix
 *   - Stores browse node affiliate links per marketplace in affiliate_links
 *   - Is marked as a category anchor (is_active = false until discovery populates it)
 *   - Fails closed: no affiliate link is emitted when the partner tag is missing
 *
 * Usage:
 *   pnpm tsx scripts/seed-by-category.ts
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (products RLS is anon read-only)
 */

import { getSupabaseServiceClient } from "../packages/database/src/client";
import {
  generateCategoryAffiliateLink,
  generateCategoryUrl,
  getEnabledAmazonCategories,
} from "../packages/shared/src/api/amazonCategoryConfig";
import { env } from "../packages/config/src/env";

interface CategoryAnchorSeed {
  name: string;
  slug: string;
  category: "physical" | "software";
  affiliateLinks: Record<string, string>;
  description: string;
  tags: string[];
}

/**
 * Builds category anchor seeds from the enabled categories.
 * Each category gets one seed entry with browse node affiliate links.
 */
function buildCategoryAnchors(): CategoryAnchorSeed[] {
  const categories = getEnabledAmazonCategories();
  const anchors: CategoryAnchorSeed[] = [];

  for (const cat of categories) {
    const affiliateLinks: Record<string, string> = {};

    // Generate affiliate links for each marketplace that has a browse node
    for (const [marketplaceCode, browseNode] of Object.entries(cat.browseNodes)) {
      try {
        const link = generateCategoryAffiliateLink(cat.code, marketplaceCode);
        affiliateLinks[`amazon-${marketplaceCode.toLowerCase()}`] = link;
      } catch {
        // Fail closed: no affiliate link for this marketplace when
        // the partner tag is not configured. The plain URL is still
        // stored so the category remains discoverable.
        try {
          affiliateLinks[`amazon-${marketplaceCode.toLowerCase()}`] = generateCategoryUrl(
            cat.code,
            marketplaceCode,
          );
        } catch {
          // Skip entirely if even the plain URL can't be built
        }
      }
    }

    // Always store the direct (non-affiliate) category URL
    try {
      affiliateLinks["direct"] = generateCategoryUrl(cat.code);
    } catch {
      // If even the direct URL fails, the category is unusable — skip it
      continue;
    }

    anchors.push({
      name: cat.name,
      slug: `category-${cat.code}`,
      category: cat.type,
      affiliateLinks,
      description: `Category anchor for ${cat.name}. Real products are populated by discovery from curated Amazon Lists.`,
      tags: ["category", cat.type, cat.code],
    });
  }

  return anchors;
}

export async function runSeeder(): Promise<void> {
  console.log("==========================================");
  console.log("  ThinkaBell Category-Driven Product Seeder ");
  console.log("==========================================");

  const anchors = buildCategoryAnchors();
  console.log(`Seeding ${anchors.length} category anchors.`);

  if (anchors.length === 0) {
    console.log("No enabled categories found. Configure AMAZON_CATEGORIES or check defaults.");
    return;
  }

  let insertedCount = 0;

  for (const anchor of anchors) {
    const { error } = await getSupabaseServiceClient()
      .from("products")
      .upsert(
        {
          name: anchor.name,
          slug: anchor.slug,
          category: anchor.category,
          brand: "category-anchor",
          amazon_asin: null,
          ebay_epid: null,
          affiliate_links: anchor.affiliateLinks,
          current_price: null,
          previous_price: null,
          price_updated_at: null,
          image_url: null,
          description: anchor.description,
          tags: anchor.tags,
          is_active: false, // Not active until discovery populates real products
          deal_type: null,
          promo_code: null,
          discount_percent: null,
          original_price: null,
          affiliate_network: "amazon",
          affiliate_id: env.AMAZON_PARTNER_TAG || null,
          sources: ["amazon-list"],
          source: "amazon-list",
          source_id: null,
          discovery_source: "category-config",
          last_discovered_at: null,
          images: [],
          video_url: null,
          metadata: {
            type: "category-anchor",
            categoryCode: anchor.tags[2] || anchor.slug.replace("category-", ""),
            discoveryPending: true,
          },
        },
        { onConflict: "slug" },
      );

    if (error) {
      console.warn(`Failed inserting ${anchor.name}:`, error.message);
    } else {
      insertedCount++;
      console.log(
        `  ✓ ${anchor.name} (${anchor.category}) — ${Object.keys(anchor.affiliateLinks).join(", ")}`,
      );
    }
  }

  console.log(
    `Successfully seeded ${insertedCount}/${anchors.length} category anchors to Supabase.`,
  );
  console.log("");
  console.log("Next steps:");
  console.log("  1. Curate public Amazon Lists and set AMAZON_LIST_URLS");
  console.log("  2. Set DISCOVERY_SOURCES with amazon-list enabled");
  console.log("  3. Run product discovery to populate real products");
  console.log("  4. Re-run this seeder whenever categories change");
}

if (require.main === module) {
  runSeeder()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Category seeder failed:", err);
      process.exit(1);
    });
}
