import { schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "@thinkabell/database";
import { amazonClient, ebayClient, redis, logger } from "@thinkabell/shared";
import pLimit from "p-limit";
import { sendAlerts } from "./sendAlerts";

export const fetchPrices = schedules.task({
  id: "fetch-prices",
  cron: "*/15 * * * *", // Runs every 15 minutes
  run: async (payload, { ctx }) => {
    logger.info("[fetchPrices] Starting scheduled price check run", { runId: ctx.run.id });

    // 1. Fetch all trackable products with Amazon ASIN or eBay EPID
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .or("amazon_asin.not.is.null,ebay_epid.not.is.null");

    if (error) {
      logger.error("[fetchPrices] Supabase query failed:", error);
      throw error;
    }

    if (!products || products.length === 0) {
      logger.info("[fetchPrices] No products found for tracking");
      return { updated: 0, alertsQueued: 0 };
    }

    logger.info(`[fetchPrices] Found ${products.length} products to check`);

    const limit = pLimit(10);
    let updatedCount = 0;
    let alertsQueuedCount = 0;

    await Promise.all(
      products.map((product) =>
        limit(async () => {
          try {
            let newPrice: number | null = null;

            if (product.amazon_asin) {
              newPrice = await amazonClient.getPrice(product.amazon_asin);
            } else if (product.ebay_epid) {
              newPrice = await ebayClient.getPrice(product.ebay_epid);
            }

            if (!newPrice || isNaN(newPrice)) {
              return;
            }

            const oldPrice = product.current_price;
            const priceChanged = oldPrice === null || Math.abs(oldPrice - newPrice) >= 0.01;

            if (priceChanged) {
              const discount =
                oldPrice && oldPrice > newPrice
                  ? ((oldPrice - newPrice) / oldPrice) * 100
                  : 0;

              logger.info(
                `[fetchPrices] Price change for "${product.name}": $${oldPrice} -> $${newPrice} (${discount.toFixed(1)}% off)`,
              );

              // 1. Update product table
              await supabase
                .from("products")
                .update({
                  current_price: newPrice,
                  previous_price: oldPrice,
                  price_updated_at: new Date().toISOString(),
                })
                .eq("id", product.id);

              // 2. Insert into price_history
              await supabase.from("price_history").insert({
                product_id: product.id,
                price: newPrice,
                source: product.amazon_asin ? "amazon" : "ebay",
              });

              updatedCount++;

              // 3. Deduplication and Alert Queueing (if discount >= 5%)
              if (oldPrice && discount >= 5) {
                const dedupeKey = `alert_sent:${product.id}:${newPrice}`;
                const alreadyQueued = await redis.get(dedupeKey);

                if (!alreadyQueued) {
                  await supabase.from("alert_queue").insert({
                    product_id: product.id,
                    old_price: oldPrice,
                    new_price: newPrice,
                    discount_percent: discount,
                    sent: false,
                  });

                  // Prevent duplicate alerts for the same price level within 24 hours
                  await redis.set(dedupeKey, "1", { ex: 86400 });
                  alertsQueuedCount++;
                } else {
                  logger.debug(`[fetchPrices] Alert deduplicated for product ${product.id}`);
                }
              }
            }
          } catch (itemError) {
            logger.error(`[fetchPrices] Failed processing product ${product.id}:`, itemError);
          }
        }),
      ),
    );

    logger.info(`[fetchPrices] Completed run. Updated: ${updatedCount}, Alerts Queued: ${alertsQueuedCount}`);

    // If new alerts were queued, proactively trigger the send-alerts task
    if (alertsQueuedCount > 0) {
      logger.info("[fetchPrices] Triggering immediate send-alerts task");
      await sendAlerts.trigger({
        type: "DECLARATIVE",
        timestamp: new Date(),
        lastTimestamp: undefined,
        timezone: "UTC",
        scheduleId: "ad-hoc",
        upcoming: [],
      });
    }

    return { updated: updatedCount, alertsQueued: alertsQueuedCount };
  },
});
