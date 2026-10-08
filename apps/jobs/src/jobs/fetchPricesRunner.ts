import { getSupabaseServiceClient } from "@thinkabell/database";
import { ProductRepository, AlertRepository, SubscriberRepository, RetailerLinkRepository } from "@thinkabell/database";
import { amazonClient, ebayClient, walmartClient, redis, logger } from "@thinkabell/shared";
import { CircuitBreaker } from "@thinkabell/shared";
import pLimit from "p-limit";

const amazonCircuit = new CircuitBreaker("amazon");
const ebayCircuit = new CircuitBreaker("ebay");
const walmartCircuit = new CircuitBreaker("walmart");

export async function runFetchPrices(): Promise<{ updated: number; alertsQueued: number }> {
  const supabase = getSupabaseServiceClient();
  logger.info("[fetchPrices] Starting price check run");

  await amazonCircuit.loadState();
  await ebayCircuit.loadState();
  await walmartCircuit.loadState();

  const { data: lockAcquired } = await supabase.rpc("try_acquire_job_lock", {
    lock_id: 1001,
  });

  if (!lockAcquired) {
    logger.info("[fetchPrices] Another instance is already running. Exiting.");
    return { updated: 0, alertsQueued: 0 };
  }

  let runId: number | null = null;

  try {
    const { data: run, error: runError } = await supabase.rpc("insert_job_run", {
      p_job_name: "fetch-prices",
      p_status: "running",
    });
    if (!runError && run) {
      runId = (run as { id: number }).id;
    }

    let products;
    try {
      products = await ProductRepository.getTrackableProducts();
    } catch (error) {
      logger.error("[fetchPrices] Failed to fetch trackable products:", error);
      throw error;
    }

    if (!products || products.length === 0) {
      logger.info("[fetchPrices] No products found for tracking");
      if (runId) {
        await supabase.rpc("update_job_run", {
          p_run_id: runId,
          p_status: "success",
          p_records_processed: 0,
          p_records_succeeded: 0,
          p_records_failed: 0,
        });
      }
      return { updated: 0, alertsQueued: 0 };
    }

    logger.info(`[fetchPrices] Found ${products.length} products to check`);

    const limit = pLimit(10);
    const batchSize = 50;
    let updatedCount = 0;
    let alertsQueuedCount = 0;
    let failedCount = 0;
    const alertBatch: Array<{
      product_id: number;
      subscriber_id: number;
      old_price: number;
      new_price: number;
      discount_percent: number;
    }> = [];

    await Promise.all(
      products.map((product) =>
        limit(async () => {
          try {
            let newPrice: number | null = null;

            if (product.amazon_asin) {
              newPrice = await amazonCircuit.execute(() => amazonClient.getPrice(product.amazon_asin as string));
            } else if (product.ebay_epid) {
              newPrice = await ebayCircuit.execute(() => ebayClient.getPrice(product.ebay_epid as string));
            } else if (product.walmart_sku) {
              newPrice = await walmartCircuit.execute(() => walmartClient.getItemPrice(product.walmart_sku as string));
            }

            if (newPrice === null || isNaN(newPrice)) {
              failedCount++;
              return;
            }

            const oldPrice = product.current_price;
            const priceChanged = oldPrice === null || Math.abs(oldPrice - newPrice) >= 0.01;

            if (!priceChanged) {
              return;
            }

            const discount =
              oldPrice && oldPrice > newPrice
                ? ((oldPrice - newPrice) / oldPrice) * 100
                : 0;

            logger.info(
              `[fetchPrices] Price change for "${product.name}": $${oldPrice} -> $${newPrice} (${discount.toFixed(1)}% off)`,
            );

            await ProductRepository.updateProductPrice(product.id, newPrice, oldPrice);

            const source = product.amazon_asin ? "amazon" : product.ebay_epid ? "ebay" : "walmart";
            await supabase.from("price_history").insert({
              product_id: product.id,
              price: newPrice,
              source,
            });

            updatedCount++;

            if (oldPrice && newPrice < oldPrice) {
              const discount = ((oldPrice - newPrice) / oldPrice) * 100;

              const subscribers = await SubscriberRepository.getSubscribersForAlert(
                product.category,
                discount,
              );

              for (const subscriber of subscribers) {
                const dedupeKey = `alert_sent:${subscriber.id}:${product.id}`;
                const alreadyQueued = await redis.get(dedupeKey);

                if (!alreadyQueued) {
                  alertBatch.push({
                    product_id: product.id,
                    subscriber_id: subscriber.id,
                    old_price: oldPrice,
                    new_price: newPrice,
                    discount_percent: discount,
                  });

                  await redis.set(dedupeKey, "1", { ex: 86400 });
                  alertsQueuedCount++;
                }
              }
            }
          } catch (itemError) {
            failedCount++;
            logger.error(`[fetchPrices] Failed processing product ${product.id}:`, itemError);
          }
        }),
      ),
    );

    if (alertBatch.length > 0) {
      const chunks = [];
      for (let i = 0; i < alertBatch.length; i += batchSize) {
        chunks.push(alertBatch.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        try {
          const { error } = await (supabase.from("alert_queue").insert(chunk) as any).onConflict("product_id,subscriber_id,sent");
          if (error) {
            logger.error("[fetchPrices] Failed to batch insert alerts:", error);
          }
        } catch (batchError) {
          logger.error("[fetchPrices] Batch insert error:", batchError);
        }
      }
    }

    const status = failedCount > 0 ? (updatedCount > 0 ? "partial" : "failed") : "success";
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: status,
        p_records_processed: products.length,
        p_records_succeeded: updatedCount,
        p_records_failed: failedCount,
      });
    }

    logger.info(`[fetchPrices] Completed run. Updated: ${updatedCount}, Alerts Queued: ${alertsQueuedCount}`);
    return { updated: updatedCount, alertsQueued: alertsQueuedCount };
  } catch (error) {
    logger.error("[fetchPrices] Run failed:", error);
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: "failed",
        p_error_message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    await supabase.rpc("release_job_lock", { lock_id: 1001 });
  }
}
