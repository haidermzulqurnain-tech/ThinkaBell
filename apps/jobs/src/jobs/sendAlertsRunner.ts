import { getSupabaseServiceClient } from "@thinkabell/database";
import { AlertRepository, SubscriberRepository, RetailerLinkRepository } from "@thinkabell/database";
import { notificationClient, logger, env } from "@thinkabell/shared";
import { retryWithBackoff } from "@thinkabell/shared";
import { decryptField, getEncryptionKey } from "@thinkabell/shared";

interface AlertWithProduct {
  id: number;
  product_id: number;
  subscriber_id: number;
  old_price: number;
  new_price: number;
  discount_percent: number;
  sent: boolean;
  attempts: number;
  last_error: string | null;
  scheduled_for: string;
  is_dead_letter: boolean;
  products: {
    id: number;
    name: string;
    slug: string;
    category: "physical" | "software";
    brand?: string;
    image_url?: string;
  };
}

interface SubscriberWithPreferences {
  id: number;
  // Email/push values are decrypted before dispatch; decryption failure or
  // absence yields null (channels disabled for that subscriber).
  email: string | null;
  push_subscription_id?: string | null;
  preferences: {
    categories?: string[];
    min_discount?: number;
    [key: string]: unknown;
  };
  is_active: boolean;
  dnd_enabled: boolean;
  dnd_start: string | null;
  dnd_end: string | null;
  digest_frequency: string;
  subscription_tier: string;
  last_notified_at: string | null;
}

function isInDND(subscriber: SubscriberWithPreferences): boolean {
  if (!subscriber.dnd_enabled || !subscriber.dnd_start || !subscriber.dnd_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const { dnd_start, dnd_end } = subscriber;

  if (dnd_start <= dnd_end) {
    return currentTime >= dnd_start && currentTime <= dnd_end;
  }

  return currentTime >= dnd_start || currentTime <= dnd_end;
}

function shouldDigestNow(subscriber: SubscriberWithPreferences): boolean {
  const { digest_frequency, last_notified_at } = subscriber;
  if (!last_notified_at || digest_frequency === "immediate") {
    return true;
  }

  const lastNotified = new Date(last_notified_at);
  const now = new Date();
  const diffMs = now.getTime() - lastNotified.getTime();

  switch (digest_frequency) {
    case "hourly":
      return diffMs >= 60 * 60 * 1000;
    case "daily":
      return diffMs >= 24 * 60 * 60 * 1000;
    case "weekly":
      return diffMs >= 7 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

export async function runSendAlerts(): Promise<{ processed: number; notificationsSent: number }> {
  const supabase = getSupabaseServiceClient();
  logger.info("[sendAlerts] Checking alert queue for pending dispatches");

  const { data: lockAcquired } = await supabase.rpc("try_acquire_job_lock", {
    lock_id: 1002,
  });

  if (!lockAcquired) {
    logger.info("[sendAlerts] Another instance is already running. Exiting.");
    return { processed: 0, notificationsSent: 0 };
  }

  let runId: number | null = null;

  try {
    const { data: run, error: runError } = await supabase.rpc("insert_job_run", {
      p_job_name: "send-alerts",
      p_status: "running",
    });
    if (!runError && run) {
      runId = (run as { id: number }).id;
    }

    const { data: rawAlerts, error: alertError } = await supabase.rpc("get_next_alerts", {
      p_limit: 50,
    });

    if (alertError) {
      logger.error("[sendAlerts] Failed to query alert queue:", alertError);
      throw alertError;
    }

    const alerts = (rawAlerts ?? []) as unknown as AlertWithProduct[];

    if (alerts.length === 0) {
      logger.info("[sendAlerts] No pending alerts in queue");
      if (runId) {
        await supabase.rpc("update_job_run", {
          p_run_id: runId,
          p_status: "success",
          p_records_processed: 0,
          p_records_succeeded: 0,
          p_records_failed: 0,
        });
      }
      return { processed: 0, notificationsSent: 0 };
    }

    logger.info(`[sendAlerts] Processing ${alerts.length} pending alerts`);

    const appUrl = env.NEXT_PUBLIC_APP_URL || "https://thinkabell.click";
    let totalNotifications = 0;
    let failedCount = 0;
    const batchSize = 50;
    const updateBatch: Array<{ id: number; sent: boolean; attempts: number; last_error?: string | null; last_notified_at?: string | null }> = [];

    const subscriberIds = [...new Set(alerts.map((a) => a.subscriber_id))];
    const { data: subscribers } = await supabase
      .from("subscribers")
      .select("*")
      .in("id", subscriberIds);

    // PII at rest may be encrypted (ENCRYPTION_KEY). Decrypt once per
    // subscriber before dispatch. When no key is configured, decryptField
    // passes values through unchanged. A single undecryptable row is
    // isolated (channels disabled) instead of failing the whole run.
    const encryptionKey = getEncryptionKey();
    const decryptedSubscribers = await Promise.all(
      (subscribers ?? []).map(async (s) => {
        try {
          const email = await decryptField(s.email ?? null, encryptionKey);
          const pushSubscriptionId = await decryptField(s.push_subscription_id ?? null, encryptionKey);
          return { ...s, email: email ?? null, push_subscription_id: pushSubscriptionId };
        } catch (decryptError) {
          logger.error(`[sendAlerts] PII decryption failed for subscriber ${s.id}; disabling channels for this run:`, decryptError);
          return { ...s, email: null, push_subscription_id: null };
        }
      }),
    );
    const subscriberMap = new Map(decryptedSubscribers.map((s) => [s.id, s]));

    for (const alert of alerts) {
      try {
        const product = alert.products;
        if (!product) {
          await AlertRepository.recordFailure(alert.id, "Missing product relation");
          updateBatch.push({ id: alert.id, sent: true, attempts: alert.attempts + 1, last_error: "Missing product" });
          failedCount++;
          continue;
        }

        const dealUrl = `${appUrl}/deal/${product.slug}`;
        const title = `🔥 Price Drop: ${product.name}`;
        const message = `Now $${alert.new_price} (${alert.discount_percent.toFixed(1)}% off, was $${alert.old_price})`;

        const subscriber = subscriberMap.get(alert.subscriber_id) ?? null;

        if (!subscriber) {
          await AlertRepository.recordFailure(alert.id, "Subscriber not found");
          updateBatch.push({ id: alert.id, sent: true, attempts: alert.attempts + 1, last_error: "Subscriber not found" });
          failedCount++;
          continue;
        }

        if (!subscriber.is_active) {
          updateBatch.push({ id: alert.id, sent: true, attempts: alert.attempts, last_error: "Subscriber inactive" });
          failedCount++;
          continue;
        }

        if (isInDND(subscriber)) {
          const now = new Date();
          const dndEnd = subscriber.dnd_end!;
          const [endHour, endMin] = dndEnd.split(":").map(Number) as [number, number];
          const scheduledFor = new Date(now);
          scheduledFor.setHours(endHour, endMin, 0, 0);
          if (scheduledFor <= now) {
            scheduledFor.setDate(scheduledFor.getDate() + 1);
          }

          await supabase
            .from("alert_queue")
            .update({ scheduled_for: scheduledFor.toISOString() })
            .eq("id", alert.id);
          continue;
        }

        if (!shouldDigestNow(subscriber)) {
          continue;
        }

        let pushSuccess = false;
        let emailSuccess = false;
        let lastError: string | null = null;

        if (subscriber.push_subscription_id) {
          try {
            await retryWithBackoff(
              () => notificationClient.sendPush(subscriber.push_subscription_id!, {
                title,
                message,
                url: dealUrl,
                imageUrl: product.image_url,
              }),
              { maxAttempts: 2 },
            );
            pushSuccess = true;
            totalNotifications++;
          } catch (pushError) {
            lastError = pushError instanceof Error ? pushError.message : String(pushError);
            logger.error(`[sendAlerts] Push failed for subscriber ${subscriber.id}:`, pushError);
          }
        }

        if (subscriber.email) {
          const recipientEmail = subscriber.email;
          try {
            await retryWithBackoff(
              () =>
                notificationClient.sendEmail(recipientEmail, {
                  subject: `Price Drop Alert: ${product.name} is now $${alert.new_price}`,
                  body: `Great news! The price of ${product.name} just dropped from $${alert.old_price} to $${alert.new_price} (a savings of ${alert.discount_percent.toFixed(1)}%). Check it out before the deal expires!`,
                  dealUrl,
                  productName: product.name,
                  currentPrice: alert.new_price,
                  previousPrice: alert.old_price,
                  discountPercent: alert.discount_percent,
                }),
              { maxAttempts: 2 },
            );
            emailSuccess = true;
            totalNotifications++;
          } catch (emailError) {
            lastError = emailError instanceof Error ? emailError.message : String(emailError);
            logger.error(`[sendAlerts] Email failed for subscriber ${subscriber.id}:`, emailError);
          }
        }

        if (pushSuccess || emailSuccess) {
          try {
            await RetailerLinkRepository.incrementClickCount(alert.product_id);
          } catch (clickError) {
            logger.debug(`[sendAlerts] No retailer links for product ${alert.product_id}`);
          }
          updateBatch.push({ id: alert.id, sent: true, attempts: alert.attempts, last_notified_at: new Date().toISOString() });
        } else if (alert.attempts + 1 >= 5) {
          await supabase.rpc("move_to_dead_letter", { p_alert_id: alert.id });
          failedCount++;
        } else {
          await AlertRepository.recordFailure(alert.id, lastError || "Unknown error");
          updateBatch.push({ id: alert.id, sent: false, attempts: alert.attempts + 1, last_error: lastError || "Unknown error" });
          failedCount++;
        }
      } catch (alertError) {
        failedCount++;
        logger.error(`[sendAlerts] Failed processing alert ${alert.id}:`, alertError);
        await AlertRepository.recordFailure(alert.id, alertError instanceof Error ? alertError.message : String(alertError));
      }
    }

    if (updateBatch.length > 0) {
      const chunks = [];
      for (let i = 0; i < updateBatch.length; i += batchSize) {
        chunks.push(updateBatch.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((update) =>
            supabase
              .from("alert_queue")
              .update({
                sent: update.sent,
                attempts: update.attempts,
                last_error: update.last_error || null,
                last_notified_at: update.last_notified_at || null,
              })
              .eq("id", update.id),
          ),
        );
      }
    }

    const status = failedCount > 0 ? (totalNotifications > 0 ? "partial" : "failed") : "success";
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: status,
        p_records_processed: alerts.length,
        p_records_succeeded: totalNotifications,
        p_records_failed: failedCount,
      });
    }

    logger.info(`[sendAlerts] Alert batch finished. Total dispatches: ${totalNotifications}`);
    return { processed: alerts.length, notificationsSent: totalNotifications };
  } catch (error) {
    logger.error("[sendAlerts] Run failed:", error);
    if (runId) {
      await supabase.rpc("update_job_run", {
        p_run_id: runId,
        p_status: "failed",
        p_error_message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    await supabase.rpc("release_job_lock", { lock_id: 1002 });
  }
}
