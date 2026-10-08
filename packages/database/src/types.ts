export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProductCategory = "physical" | "software";

export type SubscriptionTier = "free" | "pro" | "enterprise";
export type DigestFrequency = "immediate" | "hourly" | "daily" | "weekly";
export type RetailerType = "amazon" | "ebay" | "walmart";

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: number;
          user_id: string | null;
          name: string;
          slug: string;
          category: ProductCategory;
          brand: string | null;
          amazon_asin: string | null;
          ebay_epid: string | null;
          walmart_sku: string | null;
          affiliate_links: Record<string, string>;
          current_price: number | null;
          previous_price: number | null;
          price_updated_at: string | null;
          image_url: string | null;
          description: string | null;
          tags: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deal_type: string | null;
          promo_code: string | null;
          deal_end_date: string | null;
          discount_percent: number | null;
          original_price: number | null;
          affiliate_network: string | null;
          affiliate_id: string | null;
           sources: string[];
           source_id: string | null;
           discovery_source: string | null;
           last_discovered_at: string | null;
           deal_start_date: string | null;
           images: string[];
           video_url: string | null;
           metadata: Record<string, unknown> | null;
         };
         Insert: {
           id?: number;
           user_id?: string | null;
           name: string;
           slug: string;
           category: ProductCategory;
           brand?: string | null;
           amazon_asin?: string | null;
           ebay_epid?: string | null;
           walmart_sku?: string | null;
           affiliate_links?: Record<string, string>;
           current_price?: number | null;
           previous_price?: number | null;
           price_updated_at?: string | null;
           image_url?: string | null;
           description?: string | null;
           tags?: string[];
           is_active?: boolean;
           created_at?: string;
           updated_at?: string;
           deal_type?: string | null;
           promo_code?: string | null;
           deal_end_date?: string | null;
           discount_percent?: number | null;
           original_price?: number | null;
           affiliate_network?: string | null;
           affiliate_id?: string | null;
           sources?: string[];
           source_id?: string | null;
           discovery_source?: string | null;
           last_discovered_at?: string | null;
           deal_start_date?: string | null;
           images?: string[];
           video_url?: string | null;
           metadata?: Record<string, unknown> | null;
         };
         Update: {
           id?: number;
           user_id?: string | null;
           name?: string;
           slug?: string;
           category?: ProductCategory;
           brand?: string | null;
           amazon_asin?: string | null;
           ebay_epid?: string | null;
           walmart_sku?: string | null;
           affiliate_links?: Record<string, string>;
           current_price?: number | null;
           previous_price?: number | null;
           price_updated_at?: string | null;
           image_url?: string | null;
           description?: string | null;
           tags?: string[];
           is_active?: boolean;
           created_at?: string;
           updated_at?: string;
           deal_type?: string | null;
           promo_code?: string | null;
           deal_end_date?: string | null;
           discount_percent?: number | null;
           original_price?: number | null;
           affiliate_network?: string | null;
           affiliate_id?: string | null;
           sources?: string[];
           source_id?: string | null;
           discovery_source?: string | null;
           last_discovered_at?: string | null;
           deal_start_date?: string | null;
           images?: string[];
           video_url?: string | null;
           metadata?: Record<string, unknown> | null;
         };
        Relationships: [];
      };
      price_history: {
        Row: {
          id: number;
          product_id: number;
          price: number;
          source: string;
          recorded_at: string;
        };
        Insert: {
          id?: number;
          product_id: number;
          price: number;
          source: string;
          recorded_at?: string;
        };
        Update: {
          id?: number;
          product_id?: number;
          price?: number;
          source?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      subscribers: {
        Row: {
          id: number;
          user_id: string | null;
          email: string;
          email_hash: string;
          push_subscription_id: string | null;
          preferences: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          is_active: boolean;
          unsubscribed_at: string | null;
          dnd_enabled: boolean;
          dnd_start: string | null;
          dnd_end: string | null;
          digest_frequency: DigestFrequency;
          subscription_tier: SubscriptionTier;
          trial_ends_at: string | null;
          last_notified_at: string | null;
          unsubscribe_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          email: string;
          email_hash: string;
          push_subscription_id?: string | null;
          preferences?: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          is_active?: boolean;
          unsubscribed_at?: string | null;
          dnd_enabled?: boolean;
          dnd_start?: string | null;
          dnd_end?: string | null;
          digest_frequency?: DigestFrequency;
          subscription_tier?: SubscriptionTier;
          trial_ends_at?: string | null;
          last_notified_at?: string | null;
          unsubscribe_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          email?: string;
          email_hash?: string;
          push_subscription_id?: string | null;
          preferences?: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          is_active?: boolean;
          unsubscribed_at?: string | null;
          dnd_enabled?: boolean;
          dnd_start?: string | null;
          dnd_end?: string | null;
          digest_frequency?: DigestFrequency;
          subscription_tier?: SubscriptionTier;
          trial_ends_at?: string | null;
          last_notified_at?: string | null;
          unsubscribe_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alert_queue: {
        Row: {
          id: number;
          product_id: number;
          subscriber_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          created_at: string;
          sent: boolean;
          attempts: number;
          last_error: string | null;
          scheduled_for: string;
          is_dead_letter: boolean;
          alert_quality_score: number | null;
          last_notified_at: string | null;
        };
        Insert: {
          id?: number;
          product_id: number;
          subscriber_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          created_at?: string;
          sent?: boolean;
          attempts?: number;
          last_error?: string | null;
          scheduled_for?: string;
          is_dead_letter?: boolean;
          alert_quality_score?: number | null;
          last_notified_at?: string | null;
        };
        Update: {
          id?: number;
          product_id?: number;
          subscriber_id?: number;
          old_price?: number;
          new_price?: number;
          discount_percent?: number;
          created_at?: string;
          sent?: boolean;
          attempts?: number;
          last_error?: string | null;
          scheduled_for?: string;
          is_dead_letter?: boolean;
          alert_quality_score?: number | null;
          last_notified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alert_queue_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_queue_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_links: {
        Row: {
          id: number;
          product_id: number;
          retailer: RetailerType;
          affiliate_url: string;
          is_sponsored: boolean;
          click_count: number;
          commission_rate: number | null;
          current_price: number | null;
          last_checked: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          product_id: number;
          retailer: RetailerType;
          affiliate_url: string;
          is_sponsored?: boolean;
          click_count?: number;
          commission_rate?: number | null;
          current_price?: number | null;
          last_checked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          product_id?: number;
          retailer?: RetailerType;
          affiliate_url?: string;
          is_sponsored?: boolean;
          click_count?: number;
          commission_rate?: number | null;
          current_price?: number | null;
          last_checked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_links_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      click_tracking: {
        Row: {
          id: number;
          retailer_link_id: number;
          subscriber_id: number | null;
          attribution_token: string | null;
          ip_address: string | null;
          user_agent: string | null;
          clicked_at: string;
        };
        Insert: {
          id?: number;
          retailer_link_id: number;
          subscriber_id?: number | null;
          attribution_token?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          clicked_at?: string;
        };
        Update: {
          id?: number;
          retailer_link_id?: number;
          subscriber_id?: number | null;
          attribution_token?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          clicked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "click_tracking_retailer_link_id_fkey";
            columns: ["retailer_link_id"];
            isOneToOne: false;
            referencedRelation: "retailer_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "click_tracking_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_dead_letter: {
        Row: {
          id: number;
          alert_queue_id: number;
          product_id: number;
          subscriber_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          last_error: string | null;
          attempts: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          alert_queue_id: number;
          product_id: number;
          subscriber_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          last_error?: string | null;
          attempts?: number;
          created_at?: string;
        };
        Update: {
          alert_queue_id?: number;
          product_id?: number;
          subscriber_id?: number;
          old_price?: number;
          new_price?: number;
          discount_percent?: number;
          last_error?: string | null;
          attempts?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_dead_letter_alert_queue_id_fkey";
            columns: ["alert_queue_id"];
            isOneToOne: false;
            referencedRelation: "alert_queue";
            referencedColumns: ["id"];
          },
        ];
      };
      job_runs: {
        Row: {
          id: number;
          job_name: "fetch-prices" | "send-alerts";
          status: "running" | "success" | "failed" | "partial";
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          records_processed: number;
          records_succeeded: number;
          records_failed: number;
          error_message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: number;
          job_name: "fetch-prices" | "send-alerts";
          status: "running" | "success" | "failed" | "partial";
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          records_processed?: number;
          records_succeeded?: number;
          records_failed?: number;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          job_name?: "fetch-prices" | "send-alerts";
          status?: "running" | "success" | "failed" | "partial";
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          records_processed?: number;
          records_succeeded?: number;
          records_failed?: number;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_alert_attempt: {
        Args: {
          alert_id: number;
          error_text: string;
        };
        Returns: void;
      };
      get_next_alerts: {
        Args: {
          p_limit: number;
        };
        Returns: AlertQueueRow[];
      };
      move_to_dead_letter: {
        Args: {
          p_alert_id: number;
        };
        Returns: void;
      };
      increment_retailer_click: {
        Args: {
          link_id: number;
        };
        Returns: void;
      };
      try_acquire_job_lock: {
        Args: {
          lock_id: number;
        };
        Returns: boolean;
      };
      release_job_lock: {
        Args: {
          lock_id: number;
        };
        Returns: void;
      };
      insert_job_run: {
        Args: {
          p_job_name: string;
          p_status: string;
          p_records_processed?: number;
          p_records_succeeded?: number;
          p_records_failed?: number;
          p_error_message?: string;
          p_metadata?: Record<string, unknown>;
        };
        Returns: JobRunRow;
      };
      update_job_run: {
        Args: {
          p_run_id: number;
          p_status: string;
          p_records_processed?: number;
          p_records_succeeded?: number;
          p_records_failed?: number;
          p_error_message?: string;
          p_metadata?: Record<string, unknown>;
        };
        Returns: void;
      };
      get_subscribers_for_alert: {
        Args: {
          p_category: string;
          p_min_discount: number;
        };
        Returns: SubscriberRow[];
      };
    };
  };
}

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type PriceHistoryRow = Database["public"]["Tables"]["price_history"]["Row"];
export type SubscriberRow = Database["public"]["Tables"]["subscribers"]["Row"];
export type AlertQueueRow = Database["public"]["Tables"]["alert_queue"]["Row"];
export type RetailerLinkRow = Database["public"]["Tables"]["retailer_links"]["Row"];
export type ClickTrackingRow = Database["public"]["Tables"]["click_tracking"]["Row"];
export type DeadLetterRow = Database["public"]["Tables"]["alert_dead_letter"]["Row"];
export type JobRunRow = Database["public"]["Tables"]["job_runs"]["Row"];
