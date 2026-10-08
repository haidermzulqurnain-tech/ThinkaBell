import { getSupabaseAnonClient, getSupabaseServiceClient } from "../client";
import type { SubscriberRow, ProductCategory } from "../types";

export interface SubscriberPreferences {
  categories?: ProductCategory[];
  min_discount?: number;
  [key: string]: unknown;
}

export class SubscriberRepository {
  /**
   * Register or update an alert subscriber.
   *
   * `email` is the value to store (encrypted at the call site when
   * ENCRYPTION_KEY is configured). `emailHash` is the blind index used as
   * the unique upsert key (keyed HMAC-SHA256 in production, lower-case
   * email in dev fallback).
   */
  static async upsertSubscriber(
    email: string,
    emailHash: string,
    pushSubscriptionId?: string | null,
    preferences?: SubscriberPreferences,
  ): Promise<SubscriberRow> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        {
          email,
          email_hash: emailHash,
          push_subscription_id: pushSubscriptionId || null,
          preferences: preferences || { categories: ["physical", "software"], min_discount: 10 },
        },
        { onConflict: "email_hash" },
      )
      .select()
      .single();

    if (error) {
      console.error(`[SubscriberRepository] Upsert error for hash ${emailHash}:`, error.message);
      throw error;
    }

    return data as SubscriberRow;
  }

  /**
   * Fetch a subscriber by blind index (hashed email).
   */
  static async getSubscriberByEmailHash(emailHash: string): Promise<SubscriberRow | null> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("subscribers")
      .select("*")
      .eq("email_hash", emailHash)
      .maybeSingle();

    if (error) {
      console.error(`[SubscriberRepository] Lookup error for hash ${emailHash}:`, error.message);
      return null;
    }

    return (data as SubscriberRow | null) ?? null;
  }

  /**
   * Fetch all subscribers eligible for an alert based on category and discount percent.
   * Filtering is performed server-side via the get_subscribers_for_alert RPC.
   */
  static async getSubscribersForAlert(
    category: ProductCategory,
    discountPercent: number,
  ): Promise<SubscriberRow[]> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.rpc("get_subscribers_for_alert", {
      p_category: category,
      p_min_discount: discountPercent,
    });

    if (error) {
      console.error("[SubscriberRepository] Error fetching subscribers:", error.message);
      return [];
    }

    return (data ?? []) as SubscriberRow[];
  }
}
