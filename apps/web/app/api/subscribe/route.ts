import { NextResponse } from "next/server";
import { supabase } from "@thinkabell/database";
import { rateLimit } from "@thinkabell/shared";
import { z } from "zod";

const subscribeSchema = z.object({
  email: z.string().email("Invalid email format").min(5).max(255),
  push_subscription_id: z.string().nullable().optional(),
  preferences: z
    .object({
      categories: z.array(z.enum(["physical", "software"])).optional(),
      min_discount: z.number().min(1).max(99).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    // 1. IP-based Rate Limiting (5 requests per minute)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";

    const allowed = await rateLimit(`subscribe:${ip}`, 5, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many subscription attempts. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // 2. Validate Payload
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

    // 3. Database Upsert
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        {
          email: email.toLowerCase().trim(),
          push_subscription_id: push_subscription_id || null,
          preferences: preferences || { categories: ["physical", "software"], min_discount: 10 },
        },
        { onConflict: "email" },
      )
      .select()
      .single();

    if (error) {
      console.error("[SubscribeAPI] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to save subscription preferences." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Subscribed successfully.",
      data: { id: data.id, email: data.email },
    });
  } catch (err) {
    console.error("[SubscribeAPI] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
