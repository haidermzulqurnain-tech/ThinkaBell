import { getSupabaseServiceClient } from "@thinkabell/database";
import { ProductRepository } from "@thinkabell/database";
import { ebayClient, walmartClient, partnerStackClient, appSumoClient, impactClient, logger, redis } from "@thinkabell/shared";
import { CircuitBreaker } from "@thinkabell/shared";
import { AmazonListSource } from "@thinkabell/shared";
import type { DiscoveredProduct } from "@thinkabell/shared";

const sourceCircuits: Record<string, CircuitBreaker> = {
  ebay: new CircuitBreaker("discovery-ebay"),
  walmart: new CircuitBreaker("discovery-walmart"),
  partnerstack: new CircuitBreaker("discovery-partnerstack"),
  appsumo: new CircuitBreaker("discovery-appsumo"),
  impact: new CircuitBreaker("discovery-impact"),
  "amazon-list": new CircuitBreaker("discovery-amazon-list"),
};

export interface DiscoverySourceConfig {
  name: string;
  type: "physical" | "software";
  queries: string[];
  enabled: boolean;
}

function getDiscoverySources(): DiscoverySourceConfig[] {
  const raw = process.env.DISCOVERY_SOURCES || "";
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as DiscoverySourceConfig[];
    return parsed.filter(
      (source) =>
        source.enabled &&
        // amazon-list harvests curated lists configured via
        // AMAZON_LIST_URLS; explicit queries are optional
        // title filters for that source.
        (source.queries.length > 0 || source.name === "amazon-list"),
    );
  } catch {
    logger.error("[productDiscovery] Failed to parse DISCOVERY_SOURCES env var");
    return [];
  }
}

export async function runProductDiscovery(): Promise<{ discovered: number; sources: string[]; errors: string[] }> {
  const supabase = getSupabaseServiceClient();
  logger.info("[productDiscovery] Starting discovery run");

  const sources = getDiscoverySources();
  if (sources.length === 0) {
    logger.info("[productDiscovery] No discovery sources configured");
    return { discovered: 0, sources: [], errors: [] };
  }

  for (const circuit of Object.values(sourceCircuits)) {
    await circuit.loadState();
  }

  const { data: lockAcquired } = await supabase.rpc("try_acquire_job_lock", {
    lock_id: 1004,
  });

  if (!lockAcquired) {
    logger.info("[productDiscovery] Another instance is already running. Exiting.");
    return { discovered: 0, sources: [], errors: [] };
  }

  let runId: number | null = null;

  try {
    const { data: run, error: runError } = await supabase.rpc("insert_job_run", {
      p_job_name: "product-discovery",
      p_status: "running",
    });
    if (!runError && run) {
      runId = (run as { id: number }).id;
    }

    let totalDiscovered = 0;
    const discoveredBySource: Record<string, number> = {};
    const errors: string[] = [];

    for (const sourceConfig of sources) {
      const circuit = sourceCircuits[sourceConfig.name];
      if (!circuit || circuit.getState() === "open") {
        logger.warn(`[productDiscovery] Skipping source ${sourceConfig.name} - circuit breaker open`);
        continue;
      }

        try {
          const sourceProducts: DiscoveredProduct[] = [];

          // amazon-list sources without explicit queries harvest
          // once with an empty title filter.
          const queries =
            sourceConfig.name === "amazon-list" && sourceConfig.queries.length === 0
              ? [""]
              : sourceConfig.queries;

          for (const query of queries) {
            try {
              let products: DiscoveredProduct[] = [];

              switch (sourceConfig.name) {
                case "amazon-list":
                  products = await circuit.execute(async () => {
                    const source = new AmazonListSource();
                    return source.search(query);
                  });
                  break;

                case "ebay":
                products = await circuit.execute(async () => {
                  const results = await ebayClient.searchItems(query, 20);
                  const enriched = await Promise.all(
                    results.slice(0, 20).map(async (r) => {
                      try {
                        const details = await ebayClient.getItemDetails(r.itemId);
                        if (details) {
                          return {
                            sourceId: details.itemId,
                            source: "ebay" as const,
                            name: details.title,
                            description: details.description,
                            price: details.price,
                            currency: details.currency,
                            imageUrl: details.imageUrl,
                            images: details.images,
                            category: details.category,
                            url: details.url,
                            affiliateUrl: details.url,
                            metadata: { seller: details.seller, condition: details.condition, shipping: details.shipping, query },
                          };
                        }
                        return {
                          sourceId: r.itemId,
                          source: "ebay" as const,
                          name: r.title,
                          description: r.category,
                          price: r.price,
                          currency: r.currency,
                          imageUrl: r.imageUrl,
                          category: r.category,
                          url: r.url,
                          affiliateUrl: r.url,
                          metadata: { query },
                        };
                      } catch {
                        return {
                          sourceId: r.itemId,
                          source: "ebay" as const,
                          name: r.title,
                          description: r.category,
                          price: r.price,
                          currency: r.currency,
                          imageUrl: r.imageUrl,
                          category: r.category,
                          url: r.url,
                          affiliateUrl: r.url,
                          metadata: { query },
                        };
                      }
                    }),
                  );
                  return enriched;
                });
                break;

              case "walmart":
                products = await circuit.execute(async () => {
                  const results = await walmartClient.searchItems(query, 20);
                  const enriched = await Promise.all(
                    results.slice(0, 20).map(async (r) => {
                      try {
                        const details = await walmartClient.getItemDetails(r.id);
                        if (details) {
                          return {
                            sourceId: details.id,
                            source: "walmart" as const,
                            name: details.name,
                            description: details.description,
                            price: details.price,
                            currency: "USD",
                            imageUrl: details.imageUrl,
                            images: details.images,
                            category: details.category,
                            url: details.url,
                            affiliateUrl: details.url,
                            metadata: { brand: details.brand, query },
                          };
                        }
                        return {
                          sourceId: r.id,
                          source: "walmart" as const,
                          name: r.name,
                          price: r.price,
                          currency: "USD",
                          imageUrl: r.imageUrl,
                          url: `https://walmart.com/ip/${r.id}`,
                          affiliateUrl: `https://walmart.com/ip/${r.id}`,
                          metadata: { query },
                        };
                      } catch {
                        return {
                          sourceId: r.id,
                          source: "walmart" as const,
                          name: r.name,
                          price: r.price,
                          currency: "USD",
                          imageUrl: r.imageUrl,
                          url: `https://walmart.com/ip/${r.id}`,
                          affiliateUrl: `https://walmart.com/ip/${r.id}`,
                          metadata: { query },
                        };
                      }
                    }),
                  );
                  return enriched;
                });
                break;

              case "partnerstack":
                products = await circuit.execute(async () => {
                  const results = await partnerStackClient.searchProducts(query);
                  return results.map((r) => ({
                    sourceId: r.id,
                    source: "partnerstack" as const,
                    name: r.name,
                    description: r.description,
                    price: r.price,
                    currency: r.currency,
                    imageUrl: r.logo_url,
                    category: r.category,
                    url: r.url,
                    affiliateUrl: r.url,
                    metadata: { vendor: r.vendor, commission_rate: r.commission_rate, images: r.images ? [r.logo_url].filter(Boolean) : undefined },
                  }));
                });
                break;

              case "appsumo":
                products = await circuit.execute(async () => {
                  const results = await appSumoClient.searchDeals(query);
                  return results.map((r) => ({
                    sourceId: r.id,
                    source: "appsumo" as const,
                    name: r.name,
                    description: r.description,
                    price: r.price,
                    currency: r.currency,
                    category: r.category,
                    url: r.url,
                    affiliateUrl: r.url,
                    metadata: {
                      vendor: r.vendor,
                      commission_rate: r.commission_rate,
                      expiresAt: r.expiresAt,
                      images: r.images,
                    },
                  }));
                });
                break;

              case "impact":
                products = await circuit.execute(async () => {
                  const results = await impactClient.searchOffers(query);
                  return results.map((r) => ({
                    sourceId: r.id,
                    source: "impact" as const,
                    name: r.name,
                    description: r.description,
                    price: r.price,
                    currency: r.currency,
                    category: r.category,
                    url: r.url,
                    affiliateUrl: r.url,
                    metadata: {
                      advertiser: r.advertiser,
                      commission_rate: r.commission_rate,
                      images: r.images ? [r.logo_url, ...r.images].filter(Boolean) : r.logo_url ? [r.logo_url] : undefined,
                    },
                  }));
                });
                break;

              default:
                logger.warn(`[productDiscovery] Unknown source: ${sourceConfig.name}`);
                continue;
            }

            sourceProducts.push(...products);
          } catch (queryError) {
            const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
            logger.error(`[productDiscovery] Query failed for ${sourceConfig.name} - "${query}":`, queryError);
            errors.push(`${sourceConfig.name}:${query}:${errorMessage}`);
          }
        }

        if (sourceProducts.length > 0) {
          try {
            const { inserted, updated } = await ProductRepository.upsertDiscoveredProducts(
              sourceProducts.map((p) => ({
                sourceId: p.sourceId,
                source: p.source,
                amazonAsin: p.amazonAsin,
                name: p.name,
                description: p.description,
                price: p.price,
                currency: p.currency,
                imageUrl: p.imageUrl,
                images: p.images,
                category: p.category,
                url: p.url,
                affiliateUrl: p.affiliateUrl,
                type: sourceConfig.type,
                metadata: p.metadata,
              })),
            );

            totalDiscovered += inserted + updated;
            discoveredBySource[sourceConfig.name] = inserted + updated;
            logger.info(`[productDiscovery] Source ${sourceConfig.name}: discovered ${inserted + updated} products`);
          } catch (upsertError) {
            const errorMessage = upsertError instanceof Error ? upsertError.message : String(upsertError);
            logger.error(`[productDiscovery] Failed to upsert products for ${sourceConfig.name}:`, upsertError);
            errors.push(`${sourceConfig.name}:upsert:${errorMessage}`);
          }
        }
      } catch (sourceError) {
        const errorMessage = sourceError instanceof Error ? sourceError.message : String(sourceError);
        logger.error(`[productDiscovery] Source ${sourceConfig.name} failed:`, sourceError);
        errors.push(`${sourceConfig.name}:${errorMessage}`);
      }
    }

    const status = errors.length > 0 && totalDiscovered === 0 ? "failed" : errors.length > 0 ? "partial" : "success";
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: status,
        p_records_processed: totalDiscovered,
        p_records_succeeded: totalDiscovered,
        p_records_failed: errors.length,
        p_metadata: { discoveredBySource, errors },
      });
    }

    logger.info(`[productDiscovery] Completed. Total discovered: ${totalDiscovered}, Errors: ${errors.length}`);
    return { discovered: totalDiscovered, sources: Object.keys(discoveredBySource), errors };
  } catch (error) {
    logger.error("[productDiscovery] Run failed:", error);
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: "failed",
        p_error_message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    await supabase.rpc("release_job_lock", { lock_id: 1004 });
  }
}
