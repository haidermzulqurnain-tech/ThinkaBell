/**
 * @file packages/shared/src/api/amazonCategoryConfig.ts
 * @description Dynamic Amazon category configuration.
 *
 * Categories map to Amazon browse node IDs per marketplace. Browse node
 * affiliate links send visitors to a category page with the partner tag
 * attached, so qualifying purchases in that session are attributed.
 *
 * All values come from environment configuration (AMAZON_CATEGORIES JSON)
 * with sensible defaults. No products are hardcoded — categories drive
 * discovery, and products are populated by the discovery job from live
 * listings or curated Amazon Lists.
 */

import { env } from "@thinkabell/config";
import {
  resolveAmazonMarketplace,
  buildAmazonNodeAffiliateUrl,
  buildAmazonNodeUrl,
} from "./amazonAffiliateLinkGenerator";

export type ProductType = "physical" | "software";

export interface AmazonCategoryBrowseNode {
  /** Amazon browse node ID (8-14 digits). */
  nodeId: string;
  /** Human-readable category name for this marketplace. */
  label: string;
}

export interface AmazonCategoryConfig {
  /** Category code, e.g. "laptops", "headphones", "saas-tools". */
  code: string;
  /** Human-readable display name. */
  name: string;
  /** physical or software. */
  type: ProductType;
  /** Browse node IDs per marketplace code. */
  browseNodes: Record<string, AmazonCategoryBrowseNode>;
  /** Discovery queries used when this category is a discovery source. */
  queries: string[];
  /** Whether discovery is enabled for this category. */
  enabled: boolean;
}

/**
 * Default category configuration. These are category → browse node
 * mappings, not products. Override any value via AMAZON_CATEGORIES env var.
 *
 * Browse node IDs are Amazon's category identifiers. The defaults below are
 * starting points; the operator should verify them against their Amazon
 * Associates account and adjust via AMAZON_CATEGORIES.
 */
const DEFAULT_CATEGORIES: AmazonCategoryConfig[] = [
  {
    code: "laptops",
    name: "Laptops",
    type: "physical",
    browseNodes: {
      US: { nodeId: "172465", label: "Laptops" },
      UK: { nodeId: "560780", label: "Laptops" },
      DE: { nodeId: "560780", label: "Laptops" },
      CA: { nodeId: "225670", label: "Laptops" },
    },
    queries: ["developer laptop", "AI laptop", "programming laptop", "laptop deal"],
    enabled: true,
  },
  {
    code: "headphones",
    name: "Headphones",
    type: "physical",
    browseNodes: {
      US: { nodeId: "507846", label: "Headphones" },
      UK: { nodeId: "507846", label: "Headphones" },
      DE: { nodeId: "507846", label: "Kopfhörer" },
      CA: { nodeId: "507846", label: "Headphones" },
    },
    queries: ["noise canceling headphones", "wireless headphones deal", "gaming headset"],
    enabled: true,
  },
  {
    code: "smart-home",
    name: "Smart Home",
    type: "physical",
    browseNodes: {
      US: { nodeId: "468642", label: "Smart Home" },
      UK: { nodeId: "468642", label: "Smart Home" },
      DE: { nodeId: "468642", label: "Smart Home" },
      CA: { nodeId: "468642", label: "Smart Home" },
    },
    queries: ["smart home deal", "AI home device", "smart speaker deal"],
    enabled: true,
  },
  {
    code: "saas-tools",
    name: "SaaS Tools",
    type: "software",
    browseNodes: {
      US: { nodeId: "3865862", label: "Software" },
      UK: { nodeId: "3865862", label: "Software" },
      DE: { nodeId: "3865862", label: "Software" },
      CA: { nodeId: "3865862", label: "Software" },
    },
    queries: ["productivity SaaS deal", "developer tools SaaS", "AI software discount"],
    enabled: true,
  },
  {
    code: "developer-tools",
    name: "Developer Tools",
    type: "software",
    browseNodes: {
      US: { nodeId: "3865862", label: "Software" },
      UK: { nodeId: "3865862", label: "Software" },
      DE: { nodeId: "3865862", label: "Software" },
      CA: { nodeId: "3865862", label: "Software" },
    },
    queries: ["developer tool discount", "coding software deal", "IDE subscription deal"],
    enabled: true,
  },
];

const AMAZON_CATEGORIES_ENV = "AMAZON_CATEGORIES";

/**
 * Loads category configuration from the AMAZON_CATEGORIES environment
 * variable. Falls back to defaults when unset or malformed.
 *
 * The env value is a JSON array of category configs. Each entry can override
 * any field of the default for the same category code, or add new categories.
 */
export function getAmazonCategories(): AmazonCategoryConfig[] {
  const raw = env.AMAZON_CATEGORIES;
  if (!raw.trim()) {
    return DEFAULT_CATEGORIES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AMAZON_CATEGORIES must be a JSON array of category configurations");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AMAZON_CATEGORIES must be a JSON array");
  }

  const byCode = new Map(DEFAULT_CATEGORIES.map((c) => [c.code, c]));

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const code = typeof candidate.code === "string" ? candidate.code : undefined;
    if (!code) {
      continue;
    }

    const existing = byCode.get(code);
    const merged: AmazonCategoryConfig = existing
      ? { ...existing, ...(candidate as Partial<AmazonCategoryConfig>) }
      : {
          code,
          name: typeof candidate.name === "string" ? candidate.name : code,
          type:
            candidate.type === "physical" || candidate.type === "software"
              ? (candidate.type as ProductType)
              : "physical",
          browseNodes: {},
          queries: [],
          enabled: true,
        };

    if (
      candidate.browseNodes &&
      typeof candidate.browseNodes === "object" &&
      !Array.isArray(candidate.browseNodes)
    ) {
      merged.browseNodes = {
        ...merged.browseNodes,
        ...(candidate.browseNodes as Record<string, AmazonCategoryBrowseNode>),
      };
    }

    if (Array.isArray(candidate.queries)) {
      merged.queries = candidate.queries.filter((q): q is string => typeof q === "string");
    }

    if (typeof candidate.enabled === "boolean") {
      merged.enabled = candidate.enabled;
    }

    byCode.set(code, merged);
  }

  return Array.from(byCode.values());
}

/**
 * Returns only enabled categories.
 */
export function getEnabledAmazonCategories(): AmazonCategoryConfig[] {
  return getAmazonCategories().filter((c) => c.enabled);
}

/**
 * Resolves the browse node for a category and marketplace.
 *
 * @throws Error when the category has no browse node for the resolved
 *         marketplace or no partner tag is configured.
 */
export function resolveCategoryBrowseNode(
  categoryCode: string,
  country?: string,
): AmazonCategoryBrowseNode {
  const categories = getAmazonCategories();
  const category = categories.find((c) => c.code === categoryCode);
  if (!category) {
    throw new Error(`Unknown Amazon category: ${categoryCode}`);
  }

  // Reuse the affiliate link generator's marketplace resolution, which
  // validates that a partner tag is configured (fail closed).
  const marketplace = resolveAmazonMarketplace(country);

  const browseNode = category.browseNodes[marketplace.code];
  if (!browseNode) {
    throw new Error(
      `No browse node configured for category ${categoryCode} on marketplace ${marketplace.code}`,
    );
  }

  return browseNode;
}

/**
 * Generates an Amazon browse node affiliate link for a category.
 *
 * @throws Error when the category, browse node, or partner tag is not configured.
 */
export function generateCategoryAffiliateLink(categoryCode: string, country?: string): string {
  const browseNode = resolveCategoryBrowseNode(categoryCode, country);
  const marketplace = resolveAmazonMarketplace(country);
  return buildAmazonNodeAffiliateUrl(browseNode.nodeId, marketplace);
}

/**
 * Generates a plain browse node URL (no affiliate tag) for a category.
 */
export function generateCategoryUrl(categoryCode: string, country?: string): string {
  const browseNode = resolveCategoryBrowseNode(categoryCode, country);
  return buildAmazonNodeUrl(browseNode.nodeId, country);
}
