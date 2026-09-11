export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProductCategory = "physical" | "software";

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: number;
          name: string;
          slug: string;
          category: ProductCategory;
          brand: string | null;
          amazon_asin: string | null;
          ebay_epid: string | null;
          affiliate_links: Record<string, string>;
          current_price: number | null;
          previous_price: number | null;
          price_updated_at: string | null;
          image_url: string | null;
          description: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          category: ProductCategory;
          brand?: string | null;
          amazon_asin?: string | null;
          ebay_epid?: string | null;
          affiliate_links?: Record<string, string>;
          current_price?: number | null;
          previous_price?: number | null;
          price_updated_at?: string | null;
          image_url?: string | null;
          description?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          category?: ProductCategory;
          brand?: string | null;
          amazon_asin?: string | null;
          ebay_epid?: string | null;
          affiliate_links?: Record<string, string>;
          current_price?: number | null;
          previous_price?: number | null;
          price_updated_at?: string | null;
          image_url?: string | null;
          description?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
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
          email: string;
          push_subscription_id: string | null;
          preferences: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          created_at: string;
        };
        Insert: {
          id?: number;
          email: string;
          push_subscription_id?: string | null;
          preferences?: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          created_at?: string;
        };
        Update: {
          id?: number;
          email?: string;
          push_subscription_id?: string | null;
          preferences?: {
            categories?: ProductCategory[];
            min_discount?: number;
            [key: string]: unknown;
          };
          created_at?: string;
        };
        Relationships: [];
      };
      alert_queue: {
        Row: {
          id: number;
          product_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          created_at: string;
          sent: boolean;
          attempts: number;
          last_error: string | null;
        };
        Insert: {
          id?: number;
          product_id: number;
          old_price: number;
          new_price: number;
          discount_percent: number;
          created_at?: string;
          sent?: boolean;
          attempts?: number;
          last_error?: string | null;
        };
        Update: {
          id?: number;
          product_id?: number;
          old_price?: number;
          new_price?: number;
          discount_percent?: number;
          created_at?: string;
          sent?: boolean;
          attempts?: number;
          last_error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alert_queue_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
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
    };
  };
}

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type PriceHistoryRow = Database["public"]["Tables"]["price_history"]["Row"];
export type SubscriberRow = Database["public"]["Tables"]["subscribers"]["Row"];
export type AlertQueueRow = Database["public"]["Tables"]["alert_queue"]["Row"];
