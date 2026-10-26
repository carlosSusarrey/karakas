"use client";

import { useCallback, useMemo, useState } from "react";
import {
  defaultPins,
  matchPod,
  type CandidateDeck,
  type DeckRef,
  type DetectedCommander,
  type MatchResult,
  type Pin,
  type SetupPlayer,
} from "@karakas/shared";
import { photoToJpegBase64 } from "@/lib/image-resize";

type Snap = { detections: DetectedCommander[]; candidates: CandidateDeck[] };

/**
 * State for photo-based setup: the detection from the last photo plus the
 * user's answers (pins). The proposal is re-derived locally whenever players
 * or answers change, so editing one seat never redoes the rest.
 */
export function usePodSnap({
  players,
  format,
  playgroupId,
}: {
  players: SetupPlayer[];
  format: string;
  playgroupId: string | null;
}) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result: MatchResult | null = useMemo(
    () => (snap ? matchPod({ ...snap, players, format, pins }) : null),
    [snap, players, format, pins],
  );

  const detect = useCallback(
    async (file: File, previous: { playerKey: string; deck: DeckRef }[]) => {
      setError(null);
      setDetecting(true);
      try {
        const image = await photoToJpegBase64(file);
        const res = await fetch("/api/v1/games/setup/detect", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, mediaType: "image/jpeg", playgroupId, format, players, previous }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `Detection failed (${res.status})`);
        setSnap({ detections: body.detections, candidates: body.candidates });
        // Detection ids change with each photo; only per-player deck choices carry over
        setPins((prev) => prev.filter((p) => p.type === "playerDeck"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read the photo.");
      } finally {
        setDetecting(false);
      }
    },
    [playgroupId, format, players],
  );

  const answer = useCallback((newPins: Pin[]) => setPins((prev) => [...prev, ...newPins]), []);

  /** Pick a deck for one player by hand, overriding the photo. */
  const setPlayerDeck = useCallback((playerKey: string, deck: DeckRef | "none" | null) => {
    setPins((prev) => {
      const rest = prev.filter(
        (p) => !(p.type === "playerDeck" && p.playerKey === playerKey) && !(p.type === "assign" && p.playerKey === playerKey),
      );
      return deck ? [...rest, { type: "playerDeck", playerKey, deck }] : rest;
    });
  }, []);

  /** Accept every remaining suggestion. Answers can unlock follow-ups, so repeat. */
  const acceptSuggestions = useCallback(() => {
    if (!snap) return;
    let all = pins;
    for (let i = 0; i < 6; i++) {
      const r = matchPod({ ...snap, players, format, pins: all });
      if (r.questions.length === 0) break;
      all = [...all, ...defaultPins(r)];
    }
    setPins(all);
  }, [snap, players, format, pins]);

  const clear = useCallback(() => {
    setSnap(null);
    setPins([]);
    setError(null);
  }, []);

  return { result, candidates: snap?.candidates ?? [], detecting, error, detect, answer, setPlayerDeck, acceptSuggestions, clear };
}
