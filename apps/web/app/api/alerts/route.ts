import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@thinkabell/database";
import { z } from "zod";
import { rateLimit, computeBlindIndex, decryptField, getEncryptionKey } from "@thinkabell/shared";

const preferencesSchema = z.object({
  categories: z.array(z.enum(["physical", "software"])).optional(),
  min_discount: z.number().min(1).max(99).optional(),
  digest_frequency: z.enum(["immediate", "hourly", "daily", "weekly"]).optional(),
  dnd_enabled: z.boolean().optional(),
  dnd_start: z.string().nullable().optional(),
  dnd_end: z.string().nullable().optional(),
});

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return request.nextUrl.searchParams.get("api_key");
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== process.env.ALERTS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";
    const allowed = await rateLimit(`alerts:${ip}`, 30, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const email = request.nextUrl.searchParams.get("email")?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const db = getSupabaseServiceClient();
    const { data: subscriber, error: subscriberError } = await db
      .from("subscribers")
      .select("*")
      .eq("email_hash", computeBlindIndex(email))
      .maybeSingle();

    if (subscriberError) {
      console.error("[AlertsAPI] Supabase error:", subscriberError.message);
      return NextResponse.json({ error: "Failed to fetch subscriber." }, { status: 500 });
    }

    if (!subscriber) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    // Decrypt PII before returning to the caller.
    const subscriberKey = getEncryptionKey();
    const [plainEmail, plainPushId] = await Promise.all([
      decryptField(subscriber.email, subscriberKey),
      decryptField(subscriber.push_subscription_id, subscriberKey),
    ]);

    const { data: alerts, error: alertsError } = await db
      .from("alert_queue")
      .select("*")
      .eq("subscriber_id", subscriber.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (alertsError) {
      console.error("[AlertsAPI] Supabase error:", alertsError.message);
    }

    return NextResponse.json({
      found: true,
      subscriber: { ...subscriber, email: plainEmail, push_subscription_id: plainPushId },
      alerts: alerts ?? [],
    });
  } catch (err) {
    console.error("[AlertsAPI] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== process.env.ALERTS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";
    const allowed = await rateLimit(`alerts:${ip}`, 30, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const db = getSupabaseServiceClient();
    const body = await request.json().catch(() => null);
    if (!body || !body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const validation = preferencesSchema.safeParse(body.preferences || {});
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid preferences" },
        { status: 400 },
      );
    }

    const email = body.email.toLowerCase().trim();
    const { data, error } = await db
      .from("subscribers")
      .update({
        preferences: {
          ...validation.data,
          categories: validation.data.categories || ["physical", "software"],
          min_discount: validation.data.min_discount || 10,
        },
        dnd_enabled: validation.data.dnd_enabled ?? false,
        dnd_start: validation.data.dnd_start || null,
        dnd_end: validation.data.dnd_end || null,
        digest_frequency: validation.data.digest_frequency || "immediate",
        updated_at: new Date().toISOString(),
      })
      .eq("email_hash", computeBlindIndex(email))
      .select()
      .single();

    if (error) {
      console.error("[AlertsAPI] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to update preferences." }, { status: 500 });
    }

    const plainEmail = await decryptField(data.email, getEncryptionKey());

    return NextResponse.json({
      success: true,
      data: { id: data.id, email: plainEmail, preferences: data.preferences },
    });
  } catch (err) {
    console.error("[AlertsAPI] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
