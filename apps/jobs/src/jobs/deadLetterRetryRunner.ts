import { getSupabaseServiceClient } from "@thinkabell/database";
import { logger } from "@thinkabell/shared";

export async function runDeadLetterRetry(): Promise<{ retried: number; succeeded: number }> {
  const supabase = getSupabaseServiceClient();
  logger.info("[deadLetterRetry] Checking dead letter queue for retryable alerts");

  const { data: lockAcquired } = await supabase.rpc("try_acquire_job_lock", {
    lock_id: 1003,
  });

  if (!lockAcquired) {
    logger.info("[deadLetterRetry] Another instance is already running. Exiting.");
    return { retried: 0, succeeded: 0 };
  }

  try {
    const { data: deadLetters, error } = await supabase
      .from("alert_dead_letter")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      logger.error("[deadLetterRetry] Failed to query dead letter queue:", error);
      throw error;
    }

    if (!deadLetters || deadLetters.length === 0) {
      logger.info("[deadLetterRetry] No dead letters to retry");
      return { retried: 0, succeeded: 0 };
    }

    logger.info(`[deadLetterRetry] Retrying ${deadLetters.length} dead letter alerts`);

    let succeeded = 0;
    for (const deadLetter of deadLetters) {
      try {
        const { error: insertError } = await supabase.from("alert_queue").insert({
          product_id: deadLetter.product_id,
          subscriber_id: deadLetter.subscriber_id,
          old_price: deadLetter.old_price,
          new_price: deadLetter.new_price,
          discount_percent: deadLetter.discount_percent,
          sent: false,
          attempts: 0,
          last_error: null,
          scheduled_for: new Date().toISOString(),
        });

        if (insertError) {
          logger.error(`[deadLetterRetry] Failed to re-queue alert ${deadLetter.id}:`, insertError);
          continue;
        }

        await supabase
          .from("alert_dead_letter")
          .delete()
          .eq("id", deadLetter.id);

        succeeded++;
      } catch (retryError) {
        logger.error(`[deadLetterRetry] Error retrying alert ${deadLetter.id}:`, retryError);
      }
    }

    logger.info(`[deadLetterRetry] Completed. Retried: ${deadLetters.length}, Succeeded: ${succeeded}`);
    return { retried: deadLetters.length, succeeded };
  } finally {
    await supabase.rpc("release_job_lock", { lock_id: 1003 });
  }
}
