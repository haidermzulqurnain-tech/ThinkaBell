import { getSupabaseServiceClient } from "@thinkabell/database";
import { notificationClient } from "@thinkabell/shared";
import { logger } from "@thinkabell/shared";

const ALERT_THRESHOLDS = {
  FAILED_RUNS_WINDOW_HOURS: 24,
  MAX_ALERTS_PER_RUN: 20,
  MIN_RECORDS_PROCESSED_FOR_SUCCESS: 1,
} as const;

export async function runJobRunMonitoring(): Promise<{ alerted: number }> {
  const supabase = getSupabaseServiceClient();
  logger.info("[monitorJobRuns] Checking for failed or partial job runs");

  const since = new Date(Date.now() - ALERT_THRESHOLDS.FAILED_RUNS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: failedRuns, error } = await supabase
    .from("job_runs")
    .select("*")
    .in("status", ["failed", "partial"])
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(ALERT_THRESHOLDS.MAX_ALERTS_PER_RUN);

  if (error) {
    logger.error("[monitorJobRuns] Failed to query job_runs:", error);
    throw error;
  }

  if (!failedRuns || failedRuns.length === 0) {
    logger.info("[monitorJobRuns] No failed or partial job runs found in the last 24 hours");
    return { alerted: 0 };
  }

  logger.warn(`[monitorJobRuns] Found ${failedRuns.length} failed or partial job runs`);

  let alerted = 0;
  for (const run of failedRuns) {
    try {
      const shouldAlert = shouldSendAlert(run);
      if (!shouldAlert) {
        continue;
      }

      const subject = `ThinkaBell Job Alert: ${run.job_name} ${run.status}`;
      const body = buildAlertBody(run);

      const sent = await notificationClient.sendEmail("ops@thinkabell.click", {
        subject,
        body,
      });

      if (sent) {
        alerted++;
        logger.info(`[monitorJobRuns] Alert sent for run ${run.id}: ${run.job_name}`);
      }
    } catch (err) {
      logger.error(`[monitorJobRuns] Failed to send alert for run ${run.id}:`, err);
    }
  }

  logger.info(`[monitorJobRuns] Sent ${alerted}/${failedRuns.length} alerts`);
  return { alerted };
}

function shouldSendAlert(run: any): boolean {
  if (run.status === "failed") {
    return true;
  }

  if (run.status === "partial") {
    const processed = run.records_processed ?? 0;
    const succeeded = run.records_succeeded ?? 0;
    const failed = run.records_failed ?? 0;

    if (failed > 0 && succeeded === 0) {
      return true;
    }

    if (processed > 0 && processed < ALERT_THRESHOLDS.MIN_RECORDS_PROCESSED_FOR_SUCCESS) {
      return true;
    }

    if (failed > 0 && succeeded > 0 && failed / processed > 0.5) {
      return true;
    }
  }

  return false;
}

function buildAlertBody(run: any): string {
  const lines = [
    `Job: ${run.job_name}`,
    `Status: ${run.status}`,
    `Started: ${run.started_at}`,
    `Finished: ${run.finished_at || "N/A"}`,
  ];

  if (run.records_processed !== null && run.records_processed !== undefined) {
    lines.push(`Records processed: ${run.records_processed}`);
  }

  if (run.records_succeeded !== null && run.records_succeeded !== undefined) {
    lines.push(`Records succeeded: ${run.records_succeeded}`);
  }

  if (run.records_failed !== null && run.records_failed !== undefined) {
    lines.push(`Records failed: ${run.records_failed}`);
  }

  if (run.error_message) {
    lines.push(`Error: ${run.error_message}`);
  }

  if (run.metadata) {
    lines.push(`Metadata: ${JSON.stringify(run.metadata)}`);
  }

  return lines.join("\n");
}
