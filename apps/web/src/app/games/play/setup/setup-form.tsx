"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MTG_FORMATS,
  FORMAT_LABELS,
  getStartingLife,
  isCommanderFormat,
  seatsToPlayerSetup,
  type DeckKind,
  type DeckRef,
  type PendingNewDeck,
  type PlayerSetupData,
  type SeatProposal,
  type SetupDraft,
  type SetupPlayer,
} from "@karakas/shared";
import { useGame } from "@/contexts/game-context";
import { usePodSnap } from "@/components/pod-setup/use-pod-snap";
import { QuestionSheet } from "@/components/pod-setup/question-sheet";
import { clearSetupDraft } from "@/lib/setup-draft";

const POPULAR_FORMATS = ["commander", "standard", "modern", "draft", "pioneer"] as const;
const PALETTE = ["#b91c1c", "#1d4ed8", "#15803d", "#7e22ce", "#b45309", "#0e7490"];

type Playgroup = { id: string; name: string; defaultFormat: string | null };

type ApiDeck = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
};

type Deck = ApiDeck & { kind: DeckKind; ownerName: string };

type PlaygroupMember = {
  id: string;
  role: string;
  user: { id: string; username: string; email: string; avatarUrl: string | null; decks: ApiDeck[] };
};

type PlaygroupPlayer = {
  id: string;
  name: string;
  linkedUser: { id: string; username: string } | null;
  decks: ApiDeck[];
};

type PlayerSlot = {
  key: string;
  name: string;
  userId?: string;
  playgroupPlayerId?: string;
  deck?: DeckRef;
  deckOwnerName?: string;
  pendingNewDeck?: PendingNewDeck;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
  source: "member" | "player" | "guest";
};

/** What a seat card shows for the deck */
type DeckSummary = {
  title: string;
  subtitle?: string;
  badge?: { text: string; tone: "blue" | "amber" | "zinc" };
  imageUrls?: string[];
};

const guestSlots = (): PlayerSlot[] =>
  [1, 2, 3, 4].map((i) => ({ key: String(i), name: `Player ${i}`, source: "guest" }));

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function slotFromSetup(p: PlayerSetupData, i: number): PlayerSlot {
  const deck: DeckRef | undefined = p.deckId
    ? { kind: "deck", id: p.deckId }
    : p.playgroupPlayerDeckId
      ? { kind: "playgroupPlayerDeck", id: p.playgroupPlayerDeckId }
      : undefined;
  return {
    key: `r${i}`,
    name: p.name,
    userId: p.userId,
    playgroupPlayerId: p.playgroupPlayerId,
    deck,
    deckOwnerName: p.deckOwnerName,
    pendingNewDeck: p.pendingNewDeck,
    commanderUsed1: p.commanderUsed1,
    commanderUsed2: p.commanderUsed2,
    bracketUsed: p.bracketUsed,
    source: p.playgroupPlayerId ? "player" : p.userId ? "member" : "guest",
  };
}

export function SetupForm({
  aiSetup,
  initialDraft,
  initialPlaygroupId,
}: {
  aiSetup: boolean;
  initialDraft: SetupDraft | null;
  initialPlaygroupId: string | null;
}) {
  const router = useRouter();
  const { startNewGame } = useGame();

  const isRematch = !!initialDraft;
  const [format, setFormat] = useState<string>(initialDraft?.format ?? "commander");
  const [showAllFormats, setShowAllFormats] = useState(false);

  const [playgroups, setPlaygroups] = useState<Playgroup[]>([]);
  const [selectedPlaygroupId, setSelectedPlaygroupId] = useState<string | null>(
    initialDraft ? (initialDraft.playgroupId ?? null) : initialPlaygroupId,
  );
  const [members, setMembers] = useState<PlaygroupMember[]>([]);
  const [playgroupPlayers, setPlaygroupPlayers] = useState<PlaygroupPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>(() =>
    initialDraft ? initialDraft.players.map(slotFromSetup) : initialPlaygroupId ? [] : guestSlots(),
  );
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  // A rematch keeps last game's format rather than the playgroup default
  const keepFormatRef = useRef(isRematch);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ playgroups: Playgroup[] }>("/api/v1/playgroups")
      .then((d) => setPlaygroups(d.playgroups))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlaygroupId) {
      setMembers([]);
      setPlaygroupPlayers([]);
      return;
    }
    setLoading(true);
    api<{
      playgroup: { members: PlaygroupMember[]; players: PlaygroupPlayer[]; defaultFormat: string | null };
    }>(`/api/v1/playgroups/${selectedPlaygroupId}`)
      .then((d) => {
        setMembers(d.playgroup.members);
        setPlaygroupPlayers(d.playgroup.players);
        if (d.playgroup.defaultFormat && !keepFormatRef.current) setFormat(d.playgroup.defaultFormat);
        keepFormatRef.current = false;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlaygroupId]);

  const allGroupDecks = useMemo(() => {
    const decks: Deck[] = [];
    for (const m of members) {
      for (const d of m.user.decks ?? []) decks.push({ ...d, kind: "deck", ownerName: m.user.username });
    }
    for (const pp of playgroupPlayers) {
      for (const d of pp.decks) {
        decks.push({ ...d, kind: "playgroupPlayerDeck", ownerName: pp.linkedUser?.username ?? pp.name });
      }
    }
    return decks;
  }, [members, playgroupPlayers]);

  const ownDecksFor = (slot: PlayerSlot): Deck[] => {
    const own: Deck[] = [];
    const member = slot.userId ? members.find((m) => m.user.id === slot.userId) : undefined;
    if (member) own.push(...allGroupDecks.filter((d) => d.kind === "deck" && member.user.decks.some((x) => x.id === d.id)));
    const pp = slot.playgroupPlayerId ? playgroupPlayers.find((p) => p.id === slot.playgroupPlayerId) : undefined;
    if (pp) own.push(...allGroupDecks.filter((d) => d.kind === "playgroupPlayerDeck" && pp.decks.some((x) => x.id === d.id)));
    return own;
  };

  const setupPlayers: SetupPlayer[] = useMemo(
    () =>
      playerSlots.map((s) => ({
        key: s.key,
        name: s.name.trim() || "Player",
        userId: s.userId,
        playgroupPlayerId: s.playgroupPlayerId,
      })),
    [playerSlots],
  );

  const snap = usePodSnap({ players: setupPlayers, format, playgroupId: selectedPlaygroupId });
  const seatByKey = useMemo(
    () => new Map((snap.result?.seats ?? []).map((s) => [s.playerKey, s])),
    [snap.result],
  );
  const question = snap.result?.questions[0];

  const addedUserIds = new Set(playerSlots.map((p) => p.userId).filter(Boolean));
  const addedPPIds = new Set(playerSlots.map((p) => p.playgroupPlayerId).filter(Boolean));
  const availableMembers = members.filter((m) => !addedUserIds.has(m.user.id));
  const availablePPs = playgroupPlayers.filter(
    (pp) => !addedPPIds.has(pp.id) && !addedUserIds.has(pp.linkedUser?.id),
  );

  const formatsToShow = showAllFormats ? MTG_FORMATS : POPULAR_FORMATS;
  const startingLife = getStartingLife(format);
  const canSnap = aiSetup && isCommanderFormat(format) && playerSlots.length > 0;

  const updateSlot = (key: string, patch: Partial<PlayerSlot>) =>
    setPlayerSlots((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePlayer = (key: string) => setPlayerSlots((prev) => prev.filter((p) => p.key !== key));

  const addSlot = (slot: PlayerSlot) => {
    setPlayerSlots((prev) => [...prev, slot]);
    setShowAddPlayer(false);
  };

  const selectDeck = (slotKey: string, deck: Deck | null) => {
    if (snap.result) {
      snap.setPlayerDeck(slotKey, deck ? { kind: deck.kind, id: deck.id } : "none");
      return;
    }
    updateSlot(slotKey, {
      deck: deck ? { kind: deck.kind, id: deck.id } : undefined,
      deckOwnerName: undefined,
      pendingNewDeck: undefined,
      commanderUsed1: deck?.commander1 ?? undefined,
      commanderUsed2: deck?.commander2 ?? undefined,
      bracketUsed: deck?.bracket ?? undefined,
    });
  };

  const deckSummary = (slot: PlayerSlot): DeckSummary | null => {
    const seat: SeatProposal | undefined = seatByKey.get(slot.key);
    if (snap.result && seat) {
      const commanders = seat.commanders.join(" + ");
      switch (seat.status) {
        case "owned":
          return { title: seat.deckName ?? commanders, subtitle: commanders, imageUrls: seat.imageUrls };
        case "borrowed":
          return {
            title: seat.deckName ?? commanders,
            subtitle: commanders,
            badge: { text: `Borrowed from ${seat.deckOwnerName}`, tone: "blue" },
            imageUrls: seat.imageUrls,
          };
        case "new_deck":
          return { title: commanders, badge: { text: "New deck", tone: "amber" }, imageUrls: seat.imageUrls };
        case "no_deck":
          return commanders
            ? { title: commanders, badge: { text: "Commander only", tone: "zinc" }, imageUrls: seat.imageUrls }
            : { title: "No deck", badge: { text: "No deck", tone: "zinc" } };
        default:
          return null;
      }
    }
    if (slot.pendingNewDeck) {
      return { title: slot.pendingNewDeck.name, badge: { text: "New deck", tone: "amber" } };
    }
    if (slot.deck) {
      const deck = allGroupDecks.find((d) => d.kind === slot.deck!.kind && d.id === slot.deck!.id);
      const borrowed = deck && !ownDecksFor(slot).some((d) => d.id === deck.id && d.kind === deck.kind);
      return {
        title: deck?.name ?? slot.commanderUsed1 ?? "Selected deck",
        subtitle: slot.commanderUsed1,
        badge: borrowed ? { text: `Borrowed from ${deck.ownerName}`, tone: "blue" } : undefined,
      };
    }
    return null;
  };

  const effectiveDeckRefs = (): { playerKey: string; deck: DeckRef }[] =>
    playerSlots.flatMap((slot) => {
      const deck = snap.result ? seatByKey.get(slot.key)?.deck : slot.deck;
      return deck ? [{ playerKey: slot.key, deck }] : [];
    });

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    await snap.detect(file, effectiveDeckRefs());
  };

  const handleStart = () => {
    if (playerSlots.length < 2) return;
    const players: PlayerSetupData[] = snap.result
      ? seatsToPlayerSetup(setupPlayers, snap.result.seats)
      : playerSlots.map((p) => ({
          name: p.name.trim() || "Player",
          userId: p.userId,
          playgroupPlayerId: p.playgroupPlayerId,
          guestName: p.source === "guest" ? p.name.trim() || "Player" : undefined,
          deckId: p.deck?.kind === "deck" ? p.deck.id : undefined,
          playgroupPlayerDeckId: p.deck?.kind === "playgroupPlayerDeck" ? p.deck.id : undefined,
          deckOwnerName: p.deckOwnerName,
          pendingNewDeck: p.pendingNewDeck,
          commanderUsed1: p.commanderUsed1,
          commanderUsed2: p.commanderUsed2,
          bracketUsed: p.bracketUsed,
        }));
    clearSetupDraft();
    startNewGame(format, players, selectedPlaygroupId);
    router.replace("/games/play");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/games" className="text-zinc-400 hover:text-zinc-100">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">{isRematch ? "Rematch" : "New Game"}</h1>
          <div className="w-16" />
        </div>

        {isRematch && (
          <p className="mb-6 text-sm text-zinc-400">
            Same players and decks as last game. Change any seat, or retake the photo if decks changed.
          </p>
        )}

        {/* Playgroup */}
        {playgroups.length > 0 && !isRematch && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-3">Playgroup</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlaygroupId(null);
                  setPlayerSlots(guestSlots());
                  snap.clear();
                }}
                className={chipClass(!selectedPlaygroupId)}
              >
                No Playgroup
              </button>
              {playgroups.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlaygroupId(pg.id);
                    setPlayerSlots([]);
                    snap.clear();
                  }}
                  className={chipClass(selectedPlaygroupId === pg.id)}
                >
                  {pg.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Format */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Format</h2>
          <div className="flex flex-wrap gap-2">
            {formatsToShow.map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={chipClass(format === f)}>
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
          {!showAllFormats && (
            <button
              type="button"
              onClick={() => setShowAllFormats(true)}
              className="mt-2 text-amber-500 text-sm hover:underline"
            >
              Show all formats
            </button>
          )}
          <p className="text-zinc-400 text-sm mt-2">Starting life: {startingLife}</p>
        </section>

        {/* Players */}
        <section className="mb-6">
          <h2 className="text-xl font-bold mb-3">Players ({playerSlots.length})</h2>
          {loading && <p className="text-zinc-500 text-sm">Loading members…</p>}

          <div className="space-y-2">
            {playerSlots.map((slot, i) => (
              <PlayerCard
                key={slot.key}
                slot={slot}
                color={PALETTE[i % PALETTE.length]}
                format={format}
                ownDecks={ownDecksFor(slot)}
                allGroupDecks={allGroupDecks}
                summary={deckSummary(slot)}
                onNameChange={(name) => updateSlot(slot.key, { name })}
                onRemove={() => removePlayer(slot.key)}
                onSelectDeck={(d) => selectDeck(slot.key, d)}
              />
            ))}
          </div>

          {!showAddPlayer ? (
            <button
              type="button"
              onClick={() => setShowAddPlayer(true)}
              className="mt-3 w-full py-3 rounded-lg border border-dashed border-zinc-700 text-amber-500 font-semibold hover:bg-zinc-900"
            >
              + Add Player
            </button>
          ) : (
            <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
              {availableMembers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Members</h3>
                  <div className="divide-y divide-zinc-800">
                    {availableMembers.map((m) => (
                      <button
                        key={m.user.id}
                        type="button"
                        onClick={() =>
                          addSlot({ key: `m-${m.user.id}`, name: m.user.username, userId: m.user.id, source: "member" })
                        }
                        className="block w-full text-left py-2 hover:text-amber-400"
                      >
                        <div className="text-zinc-100">{m.user.username}</div>
                        <div className="text-xs text-zinc-500">{m.user.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availablePPs.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Players</h3>
                  <div className="divide-y divide-zinc-800">
                    {availablePPs.map((pp) => (
                      <button
                        key={pp.id}
                        type="button"
                        onClick={() =>
                          addSlot({
                            key: `pp-${pp.id}`,
                            name: pp.linkedUser?.username ?? pp.name,
                            playgroupPlayerId: pp.id,
                            userId: pp.linkedUser?.id,
                            source: "player",
                          })
                        }
                        className="block w-full text-left py-2 hover:text-amber-400"
                      >
                        <div className="text-zinc-100">{pp.linkedUser?.username ?? pp.name}</div>
                        {pp.linkedUser && <div className="text-xs text-zinc-500">Linked account</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  addSlot({ key: `g-${Date.now()}`, name: `Player ${playerSlots.length + 1}`, source: "guest" })
                }
                className="block w-full text-left py-2 hover:text-amber-400"
              >
                <div className="text-zinc-100">+ Guest player</div>
                <div className="text-xs text-zinc-500">Enter name manually</div>
              </button>

              <button
                type="button"
                onClick={() => setShowAddPlayer(false)}
                className="block w-full text-center text-zinc-400 hover:text-zinc-100 mt-2"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Photo setup */}
        {canSnap && (
          <section className="mb-6 bg-zinc-900 border border-amber-700/40 rounded-xl p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handlePhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold text-zinc-100">
                  {snap.result ? "Decks filled from the photo" : "Snap the commanders"}
                </div>
                <div className="text-xs text-zinc-400">
                  {snap.result
                    ? "Tap any seat to change its deck. Retake if something's off."
                    : "One photo of every commander on the table — we'll match the decks."}
                </div>
              </div>
              <button
                type="button"
                disabled={snap.detecting}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold disabled:opacity-60 hover:bg-amber-400"
              >
                {snap.detecting ? "Reading…" : snap.result ? "Retake" : "📷 Snap"}
              </button>
            </div>
            {snap.error && <p className="mt-3 text-sm text-red-400">{snap.error}</p>}
            {snap.result && (
              <button
                type="button"
                onClick={snap.clear}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Clear photo and pick decks by hand
              </button>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={playerSlots.length < 2 || snap.detecting}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-lg disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          Start Game
        </button>
      </div>

      {question && (
        <QuestionSheet
          key={question.id}
          question={question}
          remaining={snap.result!.questions.length}
          onAnswer={snap.answer}
          onSkipAll={snap.acceptSuggestions}
        />
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return [
    "px-4 py-2 rounded-lg border transition-colors",
    active
      ? "border-amber-500 bg-amber-700/20 text-amber-400 font-bold"
      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
  ].join(" ");
}

const BADGE_TONES = {
  blue: "text-blue-400",
  amber: "text-amber-400",
  zinc: "text-zinc-400",
} as const;

function PlayerCard({
  slot,
  color,
  format,
  ownDecks,
  allGroupDecks,
  summary,
  onNameChange,
  onRemove,
  onSelectDeck,
}: {
  slot: PlayerSlot;
  color: string;
  format: string;
  ownDecks: Deck[];
  allGroupDecks: Deck[];
  summary: DeckSummary | null;
  onNameChange: (name: string) => void;
  onRemove: () => void;
  onSelectDeck: (d: Deck | null) => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {slot.source === "guest" ? (
          <input
            type="text"
            value={slot.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Player name"
            className="flex-1 bg-transparent text-zinc-100 text-base focus:outline-none focus:ring-1 focus:ring-amber-500 rounded px-1 py-0.5"
          />
        ) : (
          <span className="flex-1 text-zinc-100 font-semibold">{slot.name}</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 text-sm"
          aria-label="Remove player"
        >
          ✕
        </button>
      </div>

      {summary && !picking ? (
        <div className="mt-3 ml-6 flex items-center gap-3">
          {summary.imageUrls?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={summary.imageUrls[0]} alt="" className="h-10 w-14 object-cover rounded border border-zinc-700" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-amber-500 font-semibold truncate">{summary.title}</div>
            {summary.subtitle && summary.subtitle !== summary.title && (
              <div className="text-xs text-zinc-400 truncate">{summary.subtitle}</div>
            )}
            {summary.badge && (
              <div className={`text-xs italic ${BADGE_TONES[summary.badge.tone]}`}>{summary.badge.text}</div>
            )}
          </div>
          <button type="button" onClick={() => setPicking(true)} className="text-sm text-zinc-400 hover:text-zinc-100">
            Change
          </button>
        </div>
      ) : (
        <DeckChooser
          format={format}
          ownDecks={ownDecks}
          allGroupDecks={allGroupDecks}
          canCancel={!!summary}
          onSelect={(d) => {
            onSelectDeck(d);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      )}

      {slot.source !== "guest" && (
        <div className="text-xs text-zinc-500 mt-2 ml-6">{slot.source === "member" ? "Member" : "Player"}</div>
      )}
    </div>
  );
}

function DeckChooser({
  format,
  ownDecks,
  allGroupDecks,
  canCancel,
  onSelect,
  onCancel,
}: {
  format: string;
  ownDecks: Deck[];
  allGroupDecks: Deck[];
  canCancel: boolean;
  onSelect: (deck: Deck | null) => void;
  onCancel: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const isOwn = (d: Deck) => ownDecks.some((o) => o.id === d.id && o.kind === d.kind);
  const own = ownDecks.filter((d) => d.format === format);
  const others = allGroupDecks.filter((d) => d.format === format && !isOwn(d));

  return (
    <div className="mt-3 ml-6">
      {own.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {own.map((deck) => (
            <button
              key={`${deck.kind}:${deck.id}`}
              type="button"
              onClick={() => onSelect(deck)}
              className="bg-zinc-800 rounded px-2 py-1 max-w-[160px] text-left hover:bg-zinc-700 shrink-0"
            >
              <div className="text-zinc-100 text-sm font-semibold truncate">{deck.name}</div>
              {deck.commander1 && <div className="text-xs text-zinc-500 truncate">{deck.commander1}</div>}
            </button>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-amber-500 text-sm mt-2 hover:underline"
          >
            {showAll ? "Hide other decks" : `Borrow a group deck (${others.length})`}
          </button>
          {showAll && (
            <div className="space-y-1 mt-2">
              {others.map((deck) => (
                <button
                  key={`${deck.kind}:${deck.id}`}
                  type="button"
                  onClick={() => onSelect(deck)}
                  className="block w-full bg-zinc-800 rounded px-2 py-1.5 text-left hover:bg-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-zinc-100 text-sm font-semibold">{deck.name}</div>
                      {deck.commander1 && <div className="text-xs text-zinc-500">{deck.commander1}</div>}
                    </div>
                    <div className="text-xs text-zinc-500 italic">{deck.ownerName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {own.length === 0 && others.length === 0 && (
        <div className="text-xs text-zinc-500 italic">
          No {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format} decks
        </div>
      )}

      {canCancel && (
        <div className="flex gap-4 mt-2">
          <button type="button" onClick={() => onSelect(null)} className="text-xs text-zinc-400 hover:text-zinc-100">
            No deck
          </button>
          <button type="button" onClick={onCancel} className="text-xs text-zinc-400 hover:text-zinc-100">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
