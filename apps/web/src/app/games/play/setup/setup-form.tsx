"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MTG_FORMATS, FORMAT_LABELS, getStartingLife } from "@karakas/shared";
import { useGame } from "@/contexts/game-context";

const POPULAR_FORMATS = ["commander", "standard", "modern", "draft", "pioneer"] as const;

type Playgroup = { id: string; name: string; defaultFormat: string | null };

type Deck = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
};

type PlaygroupMember = {
  id: string;
  role: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    decks: Deck[];
  };
};

type PlaygroupPlayer = {
  id: string;
  name: string;
  linkedUser: { id: string; username: string } | null;
  decks: Deck[];
};

type PlayerSlot = {
  key: string;
  name: string;
  userId?: string;
  playgroupPlayerId?: string;
  deckId?: string;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
  availableDecks: Deck[];
  source: "member" | "player" | "guest";
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function SetupForm() {
  const router = useRouter();
  const { startNewGame } = useGame();

  const [format, setFormat] = useState<string>("commander");
  const [showAllFormats, setShowAllFormats] = useState(false);

  const [playgroups, setPlaygroups] = useState<Playgroup[]>([]);
  const [selectedPlaygroupId, setSelectedPlaygroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlaygroupMember[]>([]);
  const [playgroupPlayers, setPlaygroupPlayers] = useState<PlaygroupPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([
    { key: "1", name: "Player 1", availableDecks: [], source: "guest" },
    { key: "2", name: "Player 2", availableDecks: [], source: "guest" },
    { key: "3", name: "Player 3", availableDecks: [], source: "guest" },
    { key: "4", name: "Player 4", availableDecks: [], source: "guest" },
  ]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

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
      playgroup: {
        members: PlaygroupMember[];
        players: PlaygroupPlayer[];
        defaultFormat: string | null;
      };
    }>(`/api/v1/playgroups/${selectedPlaygroupId}`)
      .then((d) => {
        setMembers(d.playgroup.members);
        setPlaygroupPlayers(d.playgroup.players);
        if (d.playgroup.defaultFormat) setFormat(d.playgroup.defaultFormat);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlaygroupId]);

  const allGroupDecks = useMemo(() => {
    const decks: (Deck & { ownerName: string })[] = [];
    for (const m of members) {
      for (const d of m.user.decks ?? []) {
        decks.push({ ...d, ownerName: m.user.username });
      }
    }
    for (const pp of playgroupPlayers) {
      for (const d of pp.decks) {
        decks.push({ ...d, bracket: null, ownerName: pp.linkedUser?.username ?? pp.name });
      }
    }
    return decks;
  }, [members, playgroupPlayers]);

  const addedUserIds = new Set(playerSlots.map((p) => p.userId).filter(Boolean));
  const addedPPIds = new Set(playerSlots.map((p) => p.playgroupPlayerId).filter(Boolean));
  const availableMembers = members.filter((m) => !addedUserIds.has(m.user.id));
  const availablePPs = playgroupPlayers.filter(
    (pp) => !addedPPIds.has(pp.id) && !addedUserIds.has(pp.linkedUser?.id),
  );

  const formatsToShow = showAllFormats ? MTG_FORMATS : POPULAR_FORMATS;
  const startingLife = getStartingLife(format);

  const updatePlayerName = (key: string, name: string) =>
    setPlayerSlots((prev) => prev.map((p) => (p.key === key ? { ...p, name } : p)));

  const removePlayer = (key: string) =>
    setPlayerSlots((prev) => prev.filter((p) => p.key !== key));

  const addMember = (m: PlaygroupMember) => {
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `m-${m.user.id}`,
        name: m.user.username,
        userId: m.user.id,
        availableDecks: m.user.decks ?? [],
        source: "member",
      },
    ]);
    setShowAddPlayer(false);
  };

  const addPP = (pp: PlaygroupPlayer) => {
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `pp-${pp.id}`,
        name: pp.linkedUser?.username ?? pp.name,
        playgroupPlayerId: pp.id,
        userId: pp.linkedUser?.id,
        availableDecks: pp.decks,
        source: "player",
      },
    ]);
    setShowAddPlayer(false);
  };

  const addGuest = () => {
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `g-${Date.now()}`,
        name: `Player ${prev.length + 1}`,
        availableDecks: [],
        source: "guest",
      },
    ]);
    setShowAddPlayer(false);
  };

  const selectDeck = (slotKey: string, deck: Deck) =>
    setPlayerSlots((prev) =>
      prev.map((p) =>
        p.key === slotKey
          ? {
              ...p,
              deckId: deck.id,
              commanderUsed1: deck.commander1 ?? undefined,
              commanderUsed2: deck.commander2 ?? undefined,
              bracketUsed: deck.bracket ?? undefined,
            }
          : p,
      ),
    );

  const clearDeck = (slotKey: string) =>
    setPlayerSlots((prev) =>
      prev.map((p) =>
        p.key === slotKey
          ? {
              ...p,
              deckId: undefined,
              commanderUsed1: undefined,
              commanderUsed2: undefined,
              bracketUsed: undefined,
            }
          : p,
      ),
    );

  const handleStart = () => {
    if (playerSlots.length < 2) return;
    const players = playerSlots.map((p) => ({
      name: p.name.trim() || "Player",
      userId: p.userId,
      playgroupPlayerId: p.playgroupPlayerId,
      deckId: p.deckId,
      commanderUsed1: p.commanderUsed1,
      commanderUsed2: p.commanderUsed2,
      bracketUsed: p.bracketUsed,
    }));
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
          <h1 className="text-2xl font-bold">New Game</h1>
          <div className="w-16" />
        </div>

        {/* Playgroup */}
        {playgroups.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-3">Playgroup</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlaygroupId(null);
                  setPlayerSlots([
                    { key: "1", name: "Player 1", availableDecks: [], source: "guest" },
                    { key: "2", name: "Player 2", availableDecks: [], source: "guest" },
                    { key: "3", name: "Player 3", availableDecks: [], source: "guest" },
                    { key: "4", name: "Player 4", availableDecks: [], source: "guest" },
                  ]);
                }}
                className={[
                  "px-4 py-2 rounded-lg border transition-colors",
                  !selectedPlaygroupId
                    ? "border-amber-500 bg-amber-700/20 text-amber-400 font-bold"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
                ].join(" ")}
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
                  }}
                  className={[
                    "px-4 py-2 rounded-lg border transition-colors",
                    selectedPlaygroupId === pg.id
                      ? "border-amber-500 bg-amber-700/20 text-amber-400 font-bold"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
                  ].join(" ")}
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
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={[
                  "px-4 py-2 rounded-lg border transition-colors",
                  format === f
                    ? "border-amber-500 bg-amber-700/20 text-amber-400 font-bold"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
                ].join(" ")}
              >
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
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Players ({playerSlots.length})</h2>
          {loading && <p className="text-zinc-500 text-sm">Loading members…</p>}

          <div className="space-y-2">
            {playerSlots.map((slot) => (
              <PlayerCard
                key={slot.key}
                slot={slot}
                format={format}
                allGroupDecks={allGroupDecks}
                onNameChange={(name) => updatePlayerName(slot.key, name)}
                onRemove={() => removePlayer(slot.key)}
                onSelectDeck={(d) => selectDeck(slot.key, d)}
                onClearDeck={() => clearDeck(slot.key)}
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
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Members
                  </h3>
                  <div className="divide-y divide-zinc-800">
                    {availableMembers.map((m) => (
                      <button
                        key={m.user.id}
                        type="button"
                        onClick={() => addMember(m)}
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
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Players
                  </h3>
                  <div className="divide-y divide-zinc-800">
                    {availablePPs.map((pp) => (
                      <button
                        key={pp.id}
                        type="button"
                        onClick={() => addPP(pp)}
                        className="block w-full text-left py-2 hover:text-amber-400"
                      >
                        <div className="text-zinc-100">{pp.linkedUser?.username ?? pp.name}</div>
                        {pp.linkedUser && (
                          <div className="text-xs text-zinc-500">Linked account</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={addGuest}
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

        <button
          type="button"
          onClick={handleStart}
          disabled={playerSlots.length < 2}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-lg disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

function PlayerCard({
  slot,
  format,
  allGroupDecks,
  onNameChange,
  onRemove,
  onSelectDeck,
  onClearDeck,
}: {
  slot: PlayerSlot;
  format: string;
  allGroupDecks: (Deck & { ownerName: string })[];
  onNameChange: (name: string) => void;
  onRemove: () => void;
  onSelectDeck: (d: Deck) => void;
  onClearDeck: () => void;
}) {
  const PALETTE = [
    "#b91c1c",
    "#1d4ed8",
    "#15803d",
    "#7e22ce",
    "#b45309",
    "#0e7490",
  ];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: PALETTE[(parseInt(slot.key.replace(/\D/g, ""), 10) || 0) % 6] || PALETTE[0] }}
        />
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

      {slot.source !== "guest" && (
        <DeckPicker
          slot={slot}
          format={format}
          allGroupDecks={allGroupDecks}
          onSelect={onSelectDeck}
          onClear={onClearDeck}
        />
      )}

      {slot.source !== "guest" && (
        <div className="text-xs text-zinc-500 mt-2 ml-6">
          {slot.source === "member" ? "Member" : "Player"}
        </div>
      )}
    </div>
  );
}

function DeckPicker({
  slot,
  format,
  allGroupDecks,
  onSelect,
  onClear,
}: {
  slot: PlayerSlot;
  format: string;
  allGroupDecks: (Deck & { ownerName: string })[];
  onSelect: (deck: Deck) => void;
  onClear: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const selected = slot.deckId
    ? slot.availableDecks.find((d) => d.id === slot.deckId) ??
      allGroupDecks.find((d) => d.id === slot.deckId)
    : null;

  const ownDecks = slot.availableDecks.filter((d) => d.format === format);
  const otherDecks = allGroupDecks.filter(
    (d) => d.format === format && !slot.availableDecks.some((od) => od.id === d.id),
  );

  if (slot.deckId && selected) {
    const owner = allGroupDecks.find((d) => d.id === slot.deckId);
    const isBorrowed = owner && !slot.availableDecks.some((d) => d.id === slot.deckId);
    return (
      <div className="mt-3 ml-6 flex items-center gap-2">
        <div className="flex-1">
          <div className="text-amber-500 font-semibold">{selected.name}</div>
          {slot.commanderUsed1 && (
            <div className="text-xs text-zinc-400">{slot.commanderUsed1}</div>
          )}
          {isBorrowed && owner && (
            <div className="text-xs text-blue-400 italic">Borrowed from {owner.ownerName}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-zinc-400 hover:text-zinc-100"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 ml-6">
      {ownDecks.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ownDecks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => onSelect(deck)}
              className="bg-zinc-800 rounded px-2 py-1 max-w-[160px] text-left hover:bg-zinc-700 shrink-0"
            >
              <div className="text-zinc-100 text-sm font-semibold truncate">{deck.name}</div>
              {deck.commander1 && (
                <div className="text-xs text-zinc-500 truncate">{deck.commander1}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {otherDecks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-amber-500 text-sm mt-2 hover:underline"
          >
            {showAll ? "Hide other decks" : `Browse all group decks (${otherDecks.length})`}
          </button>
          {showAll && (
            <div className="space-y-1 mt-2">
              {otherDecks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => onSelect(deck)}
                  className="block w-full bg-zinc-800 rounded px-2 py-1.5 text-left hover:bg-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-zinc-100 text-sm font-semibold">{deck.name}</div>
                      {deck.commander1 && (
                        <div className="text-xs text-zinc-500">{deck.commander1}</div>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 italic">{deck.ownerName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {ownDecks.length === 0 && otherDecks.length === 0 && (
        <div className="text-xs text-zinc-500 italic">
          No {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format} decks
        </div>
      )}
    </div>
  );
}
