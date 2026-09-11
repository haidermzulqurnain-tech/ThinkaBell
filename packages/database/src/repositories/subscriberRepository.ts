import { getSupabaseAnonClient, getSupabaseServiceClient } from "../client";
import type { SubscriberRow, ProductCategory } from "../types";

export interface SubscriberPreferences {
  categories?: ProductCategory[];
  min_discount?: number;
  [key: string]: unknown;
}

export class SubscriberRepository {
  /**
   * Register or update an alert subscriber by email
   */
  static async upsertSubscriber(
    email: string,
    pushSubscriptionId?: string | null,
    preferences?: SubscriberPreferences,
  ): Promise<SubscriberRow> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        {
          email: email.toLowerCase().trim(),
          push_subscription_id: pushSubscriptionId || null,
          preferences: preferences || { categories: ["physical", "software"], min_discount: 10 },
        },
        { onConflict: "email" },
      )
      .select()
      .single();

    if (error) {
      console.error(`[SubscriberRepository] Upsert error for ${email}:`, error.message);
      throw error;
    }

    return data as SubscriberRow;
  }

  /**
   * Fetch all subscribers eligible for an alert based on category and discount percent
   */
  static async getSubscribersForAlert(
    category: ProductCategory,
    discountPercent: number,
  ): Promise<SubscriberRow[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.from("subscribers").select("*");

    if (error) {
      console.error("[SubscriberRepository] Error fetching subscribers:", error.message);
      return [];
    }

    const subscribers = (data ?? []) as SubscriberRow[];

    return subscribers.filter((sub) => {
      const prefs = sub.preferences || {};
      // Filter by category if specified
      if (prefs.categories && Array.isArray(prefs.categories) && prefs.categories.length > 0) {
        if (!prefs.categories.includes(category)) return false;
      }

      // Filter by minimum discount threshold if specified
      if (typeof prefs.min_discount === "number" && prefs.min_discount > 0) {
        if (discountPercent < prefs.min_discount) return false;
      }

      return true;
    });
  }
}
