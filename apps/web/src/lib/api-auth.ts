import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";

/**
 * Extract and verify the Bearer token from a request.
 * Returns the userId if valid, null if not.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const result = await verifyAccessToken(token);
  return result?.userId ?? null;
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
