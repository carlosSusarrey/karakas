import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, revokeRefreshToken, createTokenPair } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token is required." },
        { status: 400 }
      );
    }

    const result = await verifyRefreshToken(refreshToken);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token." },
        { status: 401 }
      );
    }

    // Revoke the old refresh token (rotation)
    await revokeRefreshToken(refreshToken);

    // Issue new token pair
    const tokens = await createTokenPair(result.userId);

    return NextResponse.json(tokens);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
