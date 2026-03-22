import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAiEnabled } from "@/lib/feature-flags";
import { extractPlayLogs } from "@/lib/play-log-extractor";
import type { PlayLogExtractionContext } from "@/types/ai-events";

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
      totalTurns: true,
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

  let body: { transcript: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.transcript?.trim()) {
    return NextResponse.json({ playLogs: [] });
  }

  const context: PlayLogExtractionContext = {
    format: game.format,
    totalTurns: game.totalTurns || 1,
    players: game.players.map((p) => ({
      name: p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown",
      commander1: p.commanderUsed1 ?? undefined,
      commander2: p.commanderUsed2 ?? undefined,
    })),
  };

  try {
    const playLogs = await extractPlayLogs(body.transcript, context);
    return NextResponse.json({ playLogs });
  } catch (error) {
    console.error("[AI play-log-extract] Failed:", error);
    return NextResponse.json({ playLogs: [], error: "Extraction failed" });
  }
}
