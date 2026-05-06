import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";
import { getSession } from "./session";

/**
 * Extract and verify the Bearer token from a request, or fall back to the
 * cookie-based web session. This lets the same /api/v1/* endpoints serve
 * both the mobile app (Bearer JWT) and the web app (httpOnly cookie).
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await verifyAccessToken(token);
    if (result?.userId) return result.userId;
  }

  return await getSession();
}

/**
 * Helper to require authentication and return 401 if missing.
 * Use in API routes: const userId = await requireAuth(request); if (userId instanceof NextResponse) return userId;
 */
export async function requireAuth(
  request: NextRequest
): Promise<string | NextResponse> {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}
