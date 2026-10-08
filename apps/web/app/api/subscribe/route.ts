import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonClient, getSupabaseServiceClient } from "@thinkabell/database";
import { rateLimit, computeBlindIndex, encryptField, getEncryptionKey } from "@thinkabell/shared";
import { validateCsrfToken } from "@/src/utils/csrf";
import { z } from "zod";

// Cookie name written by /api/route-link carrying the click attribution token.
const ATTRIBUTION_COOKIE = "tb_click";

const subscribeSchema = z.object({
  // Trim before format validation so padded emails are accepted and normalized.
  email: z.string().trim().min(5).max(255).email("Invalid email format"),
  push_subscription_id: z.string().nullable().optional(),
  preferences: z
    .object({
      categories: z.array(z.enum(["physical", "software"])).optional(),
      min_discount: z.number().min(1).max(99).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const csrfValid = await validateCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const idempotencyKey = request.headers.get("Idempotency-Key");
    const rateKey = idempotencyKey ? `subscribe:${idempotencyKey}` : `subscribe:${ip}`;
    const allowed = await rateLimit(rateKey, 5, 60, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many subscription attempts. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = subscribeSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { email, push_subscription_id, preferences } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // PII handling: email and push token are encrypted at rest when
    // ENCRYPTION_KEY is set (pass-through otherwise); the keyed blind index
    // is the unique lookup key.
    const emailHash = computeBlindIndex(normalizedEmail);
    const encryptionKey = getEncryptionKey();
    // Email is validated non-empty above, so encryption always yields a value;
    // the fallback keeps the type honest for the NOT NULL column.
    const [encryptedEmail, encryptedPushId] = await Promise.all([
      encryptField(normalizedEmail, encryptionKey),
      encryptField(push_subscription_id || null, encryptionKey),
    ]);
    const storedEmail = encryptedEmail ?? normalizedEmail;

    const { data, error } = await getSupabaseAnonClient()
      .from("subscribers")
      .upsert(
        {
          email: storedEmail,
          email_hash: emailHash,
          push_subscription_id: encryptedPushId,
          preferences: preferences || { categories: ["physical", "software"], min_discount: 10 },
        },
        { onConflict: "email_hash" },
      )
      .select()
      .single();

    if (error) {
      console.error("[SubscribeAPI] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to save subscription preferences." }, { status: 500 });
    }

    // Click attribution: if the browser carries the tb_click cookie set by
    // /api/route-link, attribute that click to this subscriber. Best-effort —
    // a failed attribution must never break the subscription.
    const attributionToken = request.cookies.get(ATTRIBUTION_COOKIE)?.value;
    if (attributionToken && data?.id) {
      try {
        await getSupabaseServiceClient()
          .from("click_tracking")
          .update({ subscriber_id: data.id })
          .eq("attribution_token", attributionToken);
      } catch (attributionError) {
        console.error("[SubscribeAPI] Click attribution failed:", attributionError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Subscribed successfully.",
      data: { id: data.id, email: normalizedEmail },
    });
  } catch (err) {
    console.error("[SubscribeAPI] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
