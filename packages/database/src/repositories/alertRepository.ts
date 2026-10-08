import { getSupabaseServiceClient } from "../client";
import type { AlertQueueRow, ProductRow } from "../types";

export interface AlertWithProduct extends AlertQueueRow {
  products: ProductRow;
}

export class AlertRepository {
  /**
   * Enqueue a detected price drop into alert_queue
   */
  static async enqueueAlert(
    productId: number,
    subscriberId: number,
    oldPrice: number,
    newPrice: number,
    discountPercent: number,
  ): Promise<AlertQueueRow> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await (supabase
      .from("alert_queue")
      .insert({
        product_id: productId,
        subscriber_id: subscriberId,
        old_price: oldPrice,
        new_price: newPrice,
        discount_percent: discountPercent,
        sent: false,
      }) as any)
      .onConflict("product_id,subscriber_id,sent")
      .select()
      .single();

    if (error) {
      console.error(`[AlertRepository] Failed to enqueue alert for product ${productId}:`, error.message);
      throw error;
    }

    return data as AlertQueueRow;
  }

  /**
   * Fetch unsent alerts with full product information
   */
  static async getPendingAlerts(limit = 50): Promise<AlertWithProduct[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("alert_queue")
      .select("*, products(*)")
      .eq("sent", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("[AlertRepository] Error fetching pending alerts:", error.message);
      throw error;
    }

    return (data ?? []) as unknown as AlertWithProduct[];
  }

  /**
   * Mark alert queue record as successfully sent
   */
  static async markAlertSent(alertId: number): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("alert_queue")
      .update({ sent: true })
      .eq("id", alertId);

    if (error) {
      console.error(`[AlertRepository] Failed to mark alert ${alertId} as sent:`, error.message);
      throw error;
    }
  }

  /**
   * Record delivery failure attempt
   */
  static async recordFailure(alertId: number, errorMessage: string): Promise<void> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("increment_alert_attempt", {
      alert_id: alertId,
      error_text: errorMessage,
    });

    if (error) {
      // Fallback update if RPC is not installed
      await supabase
        .from("alert_queue")
        .update({
          last_error: errorMessage,
        })
        .eq("id", alertId);
    }
  }
}
