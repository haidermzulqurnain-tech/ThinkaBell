import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@thinkabell/database";
import { computeBlindIndex } from "@thinkabell/shared";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailHash = computeBlindIndex(normalizedEmail);
  const db = getSupabaseServiceClient();

  // Verify the subscriber row (and, when a token is supplied, its token)
  // before mutating anything — never confirm an erasure that did not happen.
  const { data: row, error: lookupError } = await db
    .from("subscribers")
    .select("id, unsubscribe_token")
    .eq("email_hash", emailHash)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Failed to process unsubscribe" }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Unsubscribe token required. Check your email for the unsubscribe link." }, { status: 400 });
  }

  if (!token) {
    if (!row.unsubscribe_token) {
      const newToken = randomUUID();
      await db
        .from("subscribers")
        .update({ unsubscribe_token: newToken })
        .eq("email_hash", emailHash);
    }

    return NextResponse.json(
      { error: "Unsubscribe token required. Check your email for the unsubscribe link." },
      { status: 400 },
    );
  }

  if (row.unsubscribe_token !== token) {
    return NextResponse.json({ error: "Unsubscribe token required. Check your email for the unsubscribe link." }, { status: 400 });
  }

  // Erasure: the anonymized email gets its own blind index so the original
  // hash can no longer locate this row (right-to-erasure).
  const anonymizedEmail = `anonymized-${randomUUID()}@deleted.local`;
  const anonymizedHash = computeBlindIndex(anonymizedEmail);

  const { error } = await db
    .from("subscribers")
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
      email: anonymizedEmail,
      email_hash: anonymizedHash,
      preferences: {},
      push_subscription_id: null,
      unsubscribe_token: randomUUID(),
    })
    .eq("email_hash", emailHash)
    .eq("unsubscribe_token", token);

  if (error) {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  // Break any click attribution link to the erased subscriber.
  await db
    .from("click_tracking")
    .update({ subscriber_id: null })
    .eq("subscriber_id", row.id);

  return NextResponse.redirect(new URL("/unsubscribe/confirmed", request.url));
}
