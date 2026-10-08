import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { env } from "@thinkabell/config";

export const dynamic = "force-dynamic";

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return request.nextUrl.searchParams.get("api_key");
}

/**
 * Only accept app-relative paths: must start with "/", and must
 * not contain "..", ":" or "//" so absolute URLs, protocol-relative
 * URLs and traversal payloads are rejected before revalidation.
 */
function isValidPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes(":") &&
    !path.includes("//")
  );
}

export async function POST(request: NextRequest) {
  try {
    // Fail-closed admin auth: unset secret rejects every request.
    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== env.REVALIDATION_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.paths)) {
      return NextResponse.json({ error: "Invalid payload. Expected { paths: string[] }" }, { status: 400 });
    }

    const paths = body.paths.filter((path: unknown): path is string => typeof path === "string");

    const results = await Promise.allSettled(
      paths.map(async (path: string) => {
        if (!isValidPath(path)) {
          throw new Error(`Invalid path: ${path}`);
        }
        revalidatePath(path);
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      revalidated: succeeded,
      failed,
      paths,
    });
  } catch (error) {
    console.error("[Revalidation] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
