import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAiEnabled } from "@/lib/feature-flags";
import { transcribeAudio } from "@/lib/whisper";

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI transcription not configured" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const game = await db.game.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  if (!audioFile) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 }
    );
  }

  try {
    console.log("[AI transcribe] Audio file:", audioFile.name, audioFile.size, "bytes, type:", audioFile.type);
    const transcript = await transcribeAudio(audioFile);
    console.log("[AI transcribe] Result:", JSON.stringify(transcript).slice(0, 200));
    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("[AI transcribe] Failed:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
