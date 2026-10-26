import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  type SetupPlayer,
} from "@karakas/shared";
import { useGame } from "../../src/contexts/game-context";
import { useAuth } from "../../src/contexts/auth-context";
import { apiFetch } from "../../src/lib/api";
import { clearSetupDraft, loadSetupDraft } from "../../src/lib/setup-draft";
import { usePodSnap } from "../../src/hooks/use-pod-snap";
import { QuestionSheet } from "../../src/components/pod-setup/QuestionSheet";
import { colors, spacing, fontSize } from "../../src/constants/theme";

const POPULAR_FORMATS = ["commander", "standard", "modern", "draft", "pioneer"] as const;

type Playgroup = {
  id: string;
  name: string;
  defaultFormat: string | null;
};

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
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    decks: ApiDeck[];
  };
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
  badge?: { text: string; color: string };
  imageUrl?: string;
};

const guestSlots = (): PlayerSlot[] =>
  [1, 2, 3, 4].map((i) => ({ key: String(i), name: `Player ${i}`, source: "guest" }));

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

function DeckPicker({
  format,
  ownDecks,
  allGroupDecks,
  summary,
  onSelect,
}: {
  format: string;
  ownDecks: Deck[];
  allGroupDecks: Deck[];
  summary: DeckSummary | null;
  onSelect: (deck: Deck | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isOwn = (d: Deck) => ownDecks.some((o) => o.id === d.id && o.kind === d.kind);
  const own = ownDecks.filter((d) => d.format === format);
  const others = allGroupDecks.filter((d) => d.format === format && !isOwn(d));
  const choose = (deck: Deck | null) => {
    onSelect(deck);
    setPicking(false);
  };

  if (summary && !picking) {
    return (
      <View style={deckStyles.section}>
        <View style={deckStyles.selected}>
          {summary.imageUrl && <Image source={{ uri: summary.imageUrl }} style={deckStyles.art} />}
          <View style={{ flex: 1 }}>
            <Text style={deckStyles.name} numberOfLines={1}>{summary.title}</Text>
            {summary.subtitle && summary.subtitle !== summary.title && (
              <Text style={deckStyles.cmd} numberOfLines={1}>{summary.subtitle}</Text>
            )}
            {summary.badge && (
              <Text style={[deckStyles.badge, { color: summary.badge.color }]}>{summary.badge.text}</Text>
            )}
          </View>
          <Pressable onPress={() => setPicking(true)}>
            <Text style={deckStyles.change}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={deckStyles.section}>
      {own.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={deckStyles.list}>
            {own.map((deck) => (
              <Pressable key={`${deck.kind}:${deck.id}`} style={deckStyles.chip} onPress={() => choose(deck)}>
                <Text style={deckStyles.chipName}>{deck.name}</Text>
                {deck.commander1 && <Text style={deckStyles.chipCmd} numberOfLines={1}>{deck.commander1}</Text>}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {others.length > 0 && (
        <>
          <Pressable onPress={() => setShowAll(!showAll)} style={deckStyles.browseToggle}>
            <Text style={deckStyles.browseText}>
              {showAll ? "Hide other decks" : `Borrow a group deck (${others.length})`}
            </Text>
          </Pressable>
          {showAll && (
            <View style={deckStyles.allList}>
              {others.map((deck) => (
                <Pressable key={`${deck.kind}:${deck.id}`} style={deckStyles.allChip} onPress={() => choose(deck)}>
                  <View style={{ flex: 1 }}>
                    <Text style={deckStyles.chipName}>{deck.name}</Text>
                    {deck.commander1 && <Text style={deckStyles.chipCmd}>{deck.commander1}</Text>}
                  </View>
                  <Text style={deckStyles.owner}>{deck.ownerName}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {own.length === 0 && others.length === 0 && (
        <Text style={deckStyles.none}>No {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format} decks</Text>
      )}

      {summary && (
        <View style={deckStyles.pickerActions}>
          <Pressable onPress={() => choose(null)}>
            <Text style={deckStyles.change}>No deck</Text>
          </Pressable>
          <Pressable onPress={() => setPicking(false)}>
            <Text style={deckStyles.change}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const deckStyles = StyleSheet.create({
  section: { marginTop: spacing.sm, marginLeft: spacing.xl },
  selected: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  art: { width: 56, height: 40, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: fontSize.md, color: colors.amber, fontWeight: "600" },
  cmd: { fontSize: fontSize.sm, color: colors.textMuted },
  badge: { fontSize: fontSize.sm, fontStyle: "italic" },
  change: { fontSize: fontSize.sm, color: colors.textSecondary },
  list: { flexDirection: "row", gap: spacing.sm },
  chip: { backgroundColor: colors.surfaceLight, borderRadius: 6, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, maxWidth: 140 },
  chipName: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
  chipCmd: { fontSize: 11, color: colors.textMuted },
  browseToggle: { marginTop: spacing.xs, paddingVertical: spacing.xs },
  browseText: { fontSize: fontSize.sm, color: colors.amber },
  allList: { marginTop: spacing.xs, gap: spacing.xs },
  allChip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceLight, borderRadius: 6, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  owner: { fontSize: 11, color: colors.textMuted, fontStyle: "italic" },
  none: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: "italic" },
  pickerActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
});

export default function GameSetupScreen() {
  const router = useRouter();
  const { rematch } = useLocalSearchParams<{ rematch?: string }>();
  const { startNewGame } = useGame();
  const { isAuthenticated, features } = useAuth();

  const [format, setFormat] = useState("commander");
  const [showAllFormats, setShowAllFormats] = useState(false);

  // Server data
  const [playgroups, setPlaygroups] = useState<Playgroup[]>([]);
  const [selectedPlaygroupId, setSelectedPlaygroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlaygroupMember[]>([]);
  const [playgroupPlayers, setPlaygroupPlayers] = useState<PlaygroupPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Player slots
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>(guestSlots);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [isRematch, setIsRematch] = useState(false);
  const keepFormatRef = useRef(false);

  // Load playgroups on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch<{ playgroups: Playgroup[] }>("/api/v1/playgroups")
      .then((data) => setPlaygroups(data.playgroups))
      .catch(() => {});
  }, [isAuthenticated]);

  // Rematch: start from last game's seats
  useEffect(() => {
    if (rematch !== "1") return;
    loadSetupDraft().then((draft) => {
      if (!draft) return;
      keepFormatRef.current = true;
      setFormat(draft.format);
      setSelectedPlaygroupId(draft.playgroupId);
      setPlayerSlots(draft.players.map(slotFromSetup));
      setIsRematch(true);
    });
  }, [rematch]);

  // Load playgroup details when selected
  useEffect(() => {
    if (!selectedPlaygroupId) {
      setMembers([]);
      setPlaygroupPlayers([]);
      return;
    }
    setLoading(true);
    apiFetch<{
      playgroup: {
        members: PlaygroupMember[];
        players: PlaygroupPlayer[];
        defaultFormat: string | null;
      };
    }>(`/api/v1/playgroups/${selectedPlaygroupId}`)
      .then((data) => {
        setMembers(data.playgroup.members);
        setPlaygroupPlayers(data.playgroup.players);
        if (data.playgroup.defaultFormat && !keepFormatRef.current) {
          setFormat(data.playgroup.defaultFormat);
        }
        keepFormatRef.current = false;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlaygroupId]);

  // Every deck in the group, for borrowing
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
  const canSnap = isAuthenticated && features.aiSetup && isCommanderFormat(format) && playerSlots.length > 0;

  // Players already added (to filter from available list)
  const addedUserIds = new Set(playerSlots.map((p) => p.userId).filter(Boolean));
  const addedPPIds = new Set(playerSlots.map((p) => p.playgroupPlayerId).filter(Boolean));

  const availableMembers = members.filter((m) => !addedUserIds.has(m.user.id));
  const availablePPs = playgroupPlayers.filter((pp) => !addedPPIds.has(pp.id) && !addedUserIds.has(pp.linkedUser?.id));

  const updateSlot = (key: string, patch: Partial<PlayerSlot>) =>
    setPlayerSlots((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const addSlot = (slot: PlayerSlot) => {
    setPlayerSlots((prev) => [...prev, slot]);
    setShowAddPlayer(false);
  };

  const removePlayer = (key: string) => {
    setPlayerSlots((prev) => prev.filter((p) => p.key !== key));
  };

  const selectDeck = (playerKey: string, deck: Deck | null) => {
    if (snap.result) {
      snap.setPlayerDeck(playerKey, deck ? { kind: deck.kind, id: deck.id } : "none");
      return;
    }
    updateSlot(playerKey, {
      deck: deck ? { kind: deck.kind, id: deck.id } : undefined,
      deckOwnerName: undefined,
      pendingNewDeck: undefined,
      commanderUsed1: deck?.commander1 ?? undefined,
      commanderUsed2: deck?.commander2 ?? undefined,
      bracketUsed: deck?.bracket ?? undefined,
    });
  };

  const deckSummary = (slot: PlayerSlot): DeckSummary | null => {
    const seat = seatByKey.get(slot.key);
    if (snap.result && seat) {
      const commanders = seat.commanders.join(" + ");
      const imageUrl = seat.imageUrls[0];
      switch (seat.status) {
        case "owned":
          return { title: seat.deckName ?? commanders, subtitle: commanders, imageUrl };
        case "borrowed":
          return {
            title: seat.deckName ?? commanders,
            subtitle: commanders,
            badge: { text: `Borrowed from ${seat.deckOwnerName}`, color: colors.blue },
            imageUrl,
          };
        case "new_deck":
          return { title: commanders, badge: { text: "New deck", color: colors.amber }, imageUrl };
        case "no_deck":
          return commanders
            ? { title: commanders, badge: { text: "Commander only", color: colors.textSecondary }, imageUrl }
            : { title: "No deck" };
        default:
          return null;
      }
    }
    if (slot.pendingNewDeck) {
      return { title: slot.pendingNewDeck.name, badge: { text: "New deck", color: colors.amber } };
    }
    if (slot.deck) {
      const deck = allGroupDecks.find((d) => d.kind === slot.deck!.kind && d.id === slot.deck!.id);
      const borrowed = deck && !ownDecksFor(slot).some((d) => d.id === deck.id && d.kind === deck.kind);
      return {
        title: deck?.name ?? slot.commanderUsed1 ?? "Selected deck",
        subtitle: slot.commanderUsed1,
        badge: borrowed ? { text: `Borrowed from ${deck.ownerName}`, color: colors.blue } : undefined,
      };
    }
    return null;
  };

  const snapPhoto = (source: "camera" | "library") => {
    const previous = playerSlots.flatMap((slot) => {
      const deck = snap.result ? seatByKey.get(slot.key)?.deck : slot.deck;
      return deck ? [{ playerKey: slot.key, deck }] : [];
    });
    snap.detect(source, previous);
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
    router.replace("/game/play");
  };

  const startingLife = getStartingLife(format);
  const formatsToShow = showAllFormats ? MTG_FORMATS : POPULAR_FORMATS;

  return (
    <>
      <Stack.Screen options={{
        title: isRematch ? "Rematch" : "New Game",
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {isRematch && (
          <Text style={styles.rematchHint}>
            Same players and decks as last game. Change any seat, or retake the photo if decks changed.
          </Text>
        )}

        {/* Playgroup Selection */}
        {isAuthenticated && playgroups.length > 0 && !isRematch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playgroup</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.formatGrid}>
                <Pressable
                  style={[
                    styles.formatChip,
                    !selectedPlaygroupId && styles.formatChipActive,
                  ]}
                  onPress={() => {
                    setSelectedPlaygroupId(null);
                    setPlayerSlots(guestSlots());
                    snap.clear();
                  }}
                >
                  <Text
                    style={[
                      styles.formatChipText,
                      !selectedPlaygroupId && styles.formatChipTextActive,
                    ]}
                  >
                    No Playgroup
                  </Text>
                </Pressable>
                {playgroups.map((pg) => (
                  <Pressable
                    key={pg.id}
                    style={[
                      styles.formatChip,
                      selectedPlaygroupId === pg.id && styles.formatChipActive,
                    ]}
                    onPress={() => {
                      setSelectedPlaygroupId(pg.id);
                      setPlayerSlots([]); // Clear players, user will add from roster
                      snap.clear();
                    }}
                  >
                    <Text
                      style={[
                        styles.formatChipText,
                        selectedPlaygroupId === pg.id && styles.formatChipTextActive,
                      ]}
                    >
                      {pg.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Format</Text>
          <View style={styles.formatGrid}>
            {formatsToShow.map((f) => (
              <Pressable
                key={f}
                style={[styles.formatChip, format === f && styles.formatChipActive]}
                onPress={() => setFormat(f)}
              >
                <Text
                  style={[
                    styles.formatChipText,
                    format === f && styles.formatChipTextActive,
                  ]}
                >
                  {FORMAT_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>
          {!showAllFormats && (
            <Pressable onPress={() => setShowAllFormats(true)}>
              <Text style={styles.showMoreText}>Show all formats</Text>
            </Pressable>
          )}
          <Text style={styles.startingLifeText}>
            Starting life: {startingLife}
          </Text>
        </View>

        {/* Players */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Players ({playerSlots.length})
          </Text>

          {loading && <ActivityIndicator color={colors.amber} />}

          {playerSlots.map((slot, index) => (
            <View key={slot.key} style={styles.playerCard}>
              <View style={styles.playerCardHeader}>
                <View
                  style={[
                    styles.playerDot,
                    { backgroundColor: colors.playerColors[index % 6] },
                  ]}
                />
                {slot.source === "guest" ? (
                  <TextInput
                    style={styles.playerNameInput}
                    value={slot.name}
                    onChangeText={(text) => updateSlot(slot.key, { name: text })}
                    placeholder="Player name"
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.playerNameText}>{slot.name}</Text>
                )}
                <Pressable onPress={() => removePlayer(slot.key)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>✕</Text>
                </Pressable>
              </View>

              {/* Deck selection */}
              <DeckPicker
                format={format}
                ownDecks={ownDecksFor(slot)}
                allGroupDecks={allGroupDecks}
                summary={deckSummary(slot)}
                onSelect={(deck) => selectDeck(slot.key, deck)}
              />

              {slot.source !== "guest" && (
                <Text style={styles.sourceTag}>
                  {slot.source === "member" ? "Member" : "Player"}
                </Text>
              )}
            </View>
          ))}

          {/* Add player button */}
          {!showAddPlayer ? (
            <Pressable
              style={styles.addPlayerButton}
              onPress={() => setShowAddPlayer(true)}
            >
              <Text style={styles.addPlayerText}>+ Add Player</Text>
            </Pressable>
          ) : (
            <View style={styles.addPlayerPanel}>
              {/* Members from playgroup */}
              {availableMembers.length > 0 && (
                <View style={styles.addSection}>
                  <Text style={styles.addSectionTitle}>Members</Text>
                  {availableMembers.map((m) => (
                    <Pressable
                      key={m.user.id}
                      style={styles.addOption}
                      onPress={() =>
                        addSlot({ key: `m-${m.user.id}`, name: m.user.username, userId: m.user.id, source: "member" })
                      }
                    >
                      <Text style={styles.addOptionText}>{m.user.username}</Text>
                      <Text style={styles.addOptionSub}>{m.user.email}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Playgroup players */}
              {availablePPs.length > 0 && (
                <View style={styles.addSection}>
                  <Text style={styles.addSectionTitle}>Players</Text>
                  {availablePPs.map((pp) => (
                    <Pressable
                      key={pp.id}
                      style={styles.addOption}
                      onPress={() =>
                        addSlot({
                          key: `pp-${pp.id}`,
                          name: pp.linkedUser?.username ?? pp.name,
                          playgroupPlayerId: pp.id,
                          userId: pp.linkedUser?.id,
                          source: "player",
                        })
                      }
                    >
                      <Text style={styles.addOptionText}>
                        {pp.linkedUser?.username ?? pp.name}
                      </Text>
                      {pp.linkedUser && (
                        <Text style={styles.addOptionSub}>Linked account</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Guest option */}
              <Pressable
                style={styles.addOption}
                onPress={() =>
                  addSlot({ key: `g-${Date.now()}`, name: `Player ${playerSlots.length + 1}`, source: "guest" })
                }
              >
                <Text style={styles.addOptionText}>+ Guest player</Text>
                <Text style={styles.addOptionSub}>Enter name manually</Text>
              </Pressable>

              <Pressable
                style={styles.cancelAddButton}
                onPress={() => setShowAddPlayer(false)}
              >
                <Text style={styles.cancelAddText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Photo setup */}
        {canSnap && (
          <View style={styles.snapCard}>
            <View style={styles.snapRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.snapTitle}>
                  {snap.result ? "Decks filled from the photo" : "Snap the commanders"}
                </Text>
                <Text style={styles.snapSub}>
                  {snap.result
                    ? "Tap any seat to change its deck. Retake if something's off."
                    : "One photo of every commander on the table — we'll match the decks."}
                </Text>
              </View>
              <Pressable
                style={[styles.snapButton, snap.detecting && styles.startButtonDisabled]}
                disabled={snap.detecting}
                onPress={() => snapPhoto("camera")}
              >
                {snap.detecting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.snapButtonText}>{snap.result ? "Retake" : "Snap"}</Text>
                )}
              </Pressable>
            </View>
            <View style={styles.snapLinks}>
              <Pressable onPress={() => snapPhoto("library")} disabled={snap.detecting}>
                <Text style={styles.snapLink}>Choose a photo</Text>
              </Pressable>
              {snap.result && (
                <Pressable onPress={snap.clear}>
                  <Text style={styles.snapLink}>Pick decks by hand</Text>
                </Pressable>
              )}
            </View>
            {snap.error && <Text style={styles.snapError}>{snap.error}</Text>}
          </View>
        )}

        {/* Start Button */}
        <Pressable
          style={[
            styles.startButton,
            (playerSlots.length < 2 || snap.detecting) && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={playerSlots.length < 2 || snap.detecting}
        >
          <Text style={styles.startButtonText}>Start Game</Text>
        </Pressable>
      </ScrollView>

      {question && (
        <QuestionSheet
          key={question.id}
          question={question}
          remaining={snap.result!.questions.length}
          onAnswer={snap.answer}
          onSkipAll={snap.acceptSuggestions}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  formatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  formatChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formatChipActive: {
    borderColor: colors.amber,
    backgroundColor: colors.amberDark + "33",
  },
  formatChipText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  formatChipTextActive: {
    color: colors.amber,
    fontWeight: "bold",
  },
  showMoreText: {
    color: colors.amber,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  startingLifeText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  // Player cards
  playerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  playerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  playerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  playerNameInput: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.text,
    paddingVertical: 2,
  },
  playerNameText: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: "600",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  sourceTag: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginLeft: spacing.xl,
  },
  // Deck selection
  deckSection: {
    marginTop: spacing.sm,
    marginLeft: spacing.xl,
  },
  selectedDeck: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  deckName: {
    fontSize: fontSize.md,
    color: colors.amber,
    fontWeight: "600",
  },
  deckCommander: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },
  changeDeckText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  deckList: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  deckChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    maxWidth: 140,
  },
  deckChipName: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "600",
  },
  deckChipCmd: {
    fontSize: 11,
    color: colors.textMuted,
  },
  noDeckText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  // Add player
  addPlayerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  addPlayerText: {
    fontSize: fontSize.lg,
    color: colors.amber,
    fontWeight: "600",
  },
  addPlayerPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
  },
  addSection: {
    marginBottom: spacing.md,
  },
  addSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  addOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addOptionText: {
    fontSize: fontSize.lg,
    color: colors.text,
  },
  addOptionSub: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  cancelAddButton: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  cancelAddText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  rematchHint: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  // Photo setup
  snapCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.amberDark + "66",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  snapRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  snapTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  snapSub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  snapButton: {
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 84,
    alignItems: "center",
  },
  snapButtonText: { fontSize: fontSize.md, fontWeight: "bold", color: colors.background },
  snapLinks: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  snapLink: { fontSize: fontSize.sm, color: colors.textSecondary },
  snapError: { fontSize: fontSize.sm, color: colors.red, marginTop: spacing.sm },
  // Start
  startButton: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.md,
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.background,
  },
});
