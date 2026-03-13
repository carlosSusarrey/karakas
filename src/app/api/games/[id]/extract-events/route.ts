import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAiEnabled } from "@/lib/feature-flags";
import { extractGameEvents } from "@/lib/game-event-extractor";
import type { ExtractionContext } from "@/types/ai-events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiEnabled(user.username)) {
    return NextResponse.json({ error: "AI features not enabled" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI extraction not configured" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const game = await db.game.findUnique({
    where: { id },
    select: {
      createdById: true,
      format: true,
      players: {
        select: {
          user: { select: { username: true } },
          playgroupPlayer: { select: { name: true } },
          guestName: true,
          commanderUsed1: true,
          commanderUsed2: true,
        },
      },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { transcript: string; previousTranscript?: string; currentTurn?: number; isSummary?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.transcript?.trim()) {
    return NextResponse.json({ events: [] });
  }

  const context: ExtractionContext = {
    format: game.format,
    currentTurn: body.currentTurn ?? 1,
    previousTranscript: body.previousTranscript ?? "",
    players: game.players.map((p) => ({
      name: p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown",
      commander1: p.commanderUsed1 ?? undefined,
      commander2: p.commanderUsed2 ?? undefined,
    })),
  };

  try {
    console.log("[AI extract] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY, "length:", process.env.ANTHROPIC_API_KEY?.length);
    console.log("[AI extract] Transcript:", body.transcript.slice(0, 200));
    console.log("[AI extract] Context players:", context.players.map(p => p.name));
    const events = await extractGameEvents(
      body.transcript,
      context,
      body.isSummary ?? false
    );
    console.log("[AI extract] Events:", JSON.stringify(events).slice(0, 500));
    return NextResponse.json({ events });
  } catch (error) {
    console.error("[AI extract] Failed:", error);
    return NextResponse.json({ events: [], error: "Extraction failed" });
  }
}
