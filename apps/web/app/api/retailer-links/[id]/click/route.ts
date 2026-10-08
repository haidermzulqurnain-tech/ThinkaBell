import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@thinkabell/database";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const linkId = Number(params.id);
    const supabase = getSupabaseServiceClient();

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    const { error } = await supabase.from("click_tracking").insert({
      retailer_link_id: linkId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Increment click count
    await supabase.rpc("increment_retailer_click", { link_id: linkId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ClickTracking] Error recording click:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
