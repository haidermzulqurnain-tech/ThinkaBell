import { schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "@thinkabell/database";
import { notificationClient, logger, env } from "@thinkabell/shared";

interface AlertRecord {
  id: number;
  product_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  sent: boolean;
  products: {
    id: number;
    name: string;
    slug: string;
    category: "physical" | "software";
    brand?: string;
    image_url?: string;
  };
}

interface SubscriberRecord {
  id: number;
  email: string;
  push_subscription_id?: string | null;
  preferences: {
    categories?: string[];
    min_discount?: number;
    [key: string]: unknown;
  };
}

export const sendAlerts = schedules.task({
  id: "send-alerts",
  cron: "*/5 * * * *", // Runs every 5 minutes
  run: async (payload, { ctx }) => {
    logger.info("[sendAlerts] Checking alert queue for pending dispatches", { runId: ctx.run.id });

    // 1. Fetch pending alerts joined with product metadata
    const { data: rawAlerts, error: alertError } = await supabase
      .from("alert_queue")
      .select("*, products(*)")
      .eq("sent", false)
      .limit(50);

    if (alertError) {
      logger.error("[sendAlerts] Failed to query alert queue:", alertError);
      throw alertError;
    }

    const alerts = (rawAlerts ?? []) as unknown as AlertRecord[];

    if (alerts.length === 0) {
      logger.info("[sendAlerts] No pending alerts in queue");
      return { processed: 0, notificationsSent: 0 };
    }

    logger.info(`[sendAlerts] Processing ${alerts.length} pending alerts`);

    // 2. Fetch all subscribers
    const { data: rawSubscribers, error: subError } = await supabase
      .from("subscribers")
      .select("*");

    if (subError) {
      logger.error("[sendAlerts] Failed to query subscribers:", subError);
      throw subError;
    }

    const subscribers = (rawSubscribers ?? []) as unknown as SubscriberRecord[];
    const appUrl = env.NEXT_PUBLIC_APP_URL || "https://thinkabell.click";
    let totalNotifications = 0;

    for (const alert of alerts) {
      const product = alert.products;
      if (!product) {
        // Missing product relation, mark sent to prevent getting stuck
        await supabase.from("alert_queue").update({ sent: true }).eq("id", alert.id);
        continue;
      }

      // Filter subscribers by preference
      const matchingSubscribers = subscribers.filter((sub) => {
        const prefs = sub.preferences || {};
        if (prefs.categories && Array.isArray(prefs.categories) && prefs.categories.length > 0) {
          if (!prefs.categories.includes(product.category)) return false;
        }
        if (typeof prefs.min_discount === "number" && alert.discount_percent < prefs.min_discount) {
          return false;
        }
        return true;
      });

      logger.info(
        `[sendAlerts] Alert #${alert.id} (${product.name}): matching ${matchingSubscribers.length} subscribers`,
      );

      const dealUrl = `${appUrl}/deal/${product.slug}`;
      const title = `🔥 Price Drop: ${product.name}`;
      const message = `Now $${alert.new_price} (${alert.discount_percent.toFixed(1)}% off, was $${alert.old_price})`;

      for (const subscriber of matchingSubscribers) {
        // Send Web Push notification
        if (subscriber.push_subscription_id) {
          await notificationClient.sendPush(subscriber.push_subscription_id, {
            title,
            message,
            url: dealUrl,
            imageUrl: product.image_url,
          });
          totalNotifications++;
        }

        // Send Email notification
        if (subscriber.email) {
          await notificationClient.sendEmail(subscriber.email, {
            subject: `Price Drop Alert: ${product.name} is now $${alert.new_price}`,
            body: `Great news! The price of ${product.name} just dropped from $${alert.old_price} to $${alert.new_price} (a savings of ${alert.discount_percent.toFixed(1)}%). Check it out before the deal expires!`,
            dealUrl,
            productName: product.name,
            currentPrice: alert.new_price,
            previousPrice: alert.old_price,
            discountPercent: alert.discount_percent,
          });
          totalNotifications++;
        }
      }

      // Mark alert as sent in queue
      await supabase.from("alert_queue").update({ sent: true }).eq("id", alert.id);
    }

    logger.info(`[sendAlerts] Alert batch finished. Total dispatches: ${totalNotifications}`);
    return { processed: alerts.length, notificationsSent: totalNotifications };
  },
});
