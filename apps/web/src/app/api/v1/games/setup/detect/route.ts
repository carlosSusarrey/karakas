import { NextRequest, NextResponse } from "next/server";
import { matchPod, type DeckRef, type SetupPlayer } from "@karakas/shared";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { isAiEnabled } from "@/lib/feature-flags";
import { detectCommanders, DetectionError, type ImageMediaType } from "@/lib/commander-detector";
import { loadCandidates, knownCommanderNames } from "@/lib/pod-candidates";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ~3.5MB of base64 ≈ 2.6MB image; clients resize to ~1568px so this is generous. */
const MAX_IMAGE_BASE64 = 3_500_000;
const MAX_PLAYERS = 8;
const MEDIA_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp"];

type DetectRequest = {
  image: string;
  mediaType: ImageMediaType;
  playgroupId: string | null;
  format: string;
  players: SetupPlayer[];
  previous?: { playerKey: string; deck: DeckRef }[];
};

/**
 * Identify the commanders in a photo of the table and propose who is playing
 * which deck. The photo is discarded after detection.
 */
export async function POST(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user || !isAiEnabled(user.username)) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }
  if (!checkRateLimit(`detect:${userId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many photos — try again in a bit." }, { status: 429 });
  }

  let body: DetectRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { image, mediaType, format, players, previous } = body;
  const playgroupId = body.playgroupId ?? null;
  if (typeof image !== "string" || image.length === 0 || image.startsWith("data:")) {
    return NextResponse.json({ error: "image must be raw base64" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_BASE64) {
    return NextResponse.json({ error: "Image is too large" }, { status: 400 });
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (!format || !Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS) {
    return NextResponse.json({ error: `Between 1 and ${MAX_PLAYERS} players are required` }, { status: 400 });
  }
  if (players.some((p) => !p?.key || typeof p.name !== "string")) {
    return NextResponse.json({ error: "Each player needs a key and a name" }, { status: 400 });
  }

  if (playgroupId) {
    const membership = await db.playgroupMember.findUnique({
      where: { playgroupId_userId: { playgroupId, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this playgroup" }, { status: 403 });
    }
  }

  const candidates = await loadCandidates(playgroupId, userId);

  let detections;
  try {
    detections = await detectCommanders({
      image,
      mediaType,
      playerCount: players.length,
      knownCommanders: knownCommanderNames(candidates),
    });
  } catch (error) {
    // Never include the request body in logs
    console.error("Commander detection failed:", error instanceof Error ? error.message : "unknown error");
    const message =
      error instanceof DetectionError ? error.message : "Couldn't read the photo. Try again or set up manually.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const result = matchPod({ detections, players, candidates, format, previous });
  return NextResponse.json({ detections, candidates, result });
}
