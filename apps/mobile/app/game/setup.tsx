import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MTG_FORMATS, FORMAT_LABELS, getStartingLife } from "@karakas/shared";
import { useGame } from "../../src/contexts/game-context";
import { useAuth } from "../../src/contexts/auth-context";
import { apiFetch } from "../../src/lib/api";
import { colors, spacing, fontSize } from "../../src/constants/theme";

const POPULAR_FORMATS = ["commander", "standard", "modern", "draft", "pioneer"] as const;

type Playgroup = {
  id: string;
  name: string;
  defaultFormat: string | null;
};

type PlaygroupMember = {
  id: string;
  role: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    decks: { id: string; name: string; format: string; commander1: string | null; commander2: string | null; bracket: number | null }[];
  };
};

type PlaygroupPlayer = {
  id: string;
  name: string;
  linkedUser: { id: string; username: string } | null;
  decks: { id: string; name: string; format: string; commander1: string | null; commander2: string | null }[];
};

type Deck = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
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
  // For display
  availableDecks: Deck[];
  source: "member" | "player" | "guest";
};

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

  // Find selected deck from either own decks or all group decks
  const selectedDeck = slot.deckId
    ? slot.availableDecks.find((d) => d.id === slot.deckId)
      ?? allGroupDecks.find((d) => d.id === slot.deckId)
    : null;

  const ownDecks = slot.availableDecks.filter((d) => d.format === format);
  const otherDecks = allGroupDecks
    .filter((d) => d.format === format && !slot.availableDecks.some((od) => od.id === d.id));

  if (slot.deckId && selectedDeck) {
    const owner = allGroupDecks.find((d) => d.id === slot.deckId);
    return (
      <View style={deckStyles.section}>
        <View style={deckStyles.selected}>
          <View style={{ flex: 1 }}>
            <Text style={deckStyles.name}>{selectedDeck.name}</Text>
            {slot.commanderUsed1 && <Text style={deckStyles.cmd}>{slot.commanderUsed1}</Text>}
            {owner && !slot.availableDecks.some((d) => d.id === slot.deckId) && (
              <Text style={deckStyles.borrowed}>Borrowed from {owner.ownerName}</Text>
            )}
          </View>
          <Pressable onPress={onClear}>
            <Text style={deckStyles.change}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={deckStyles.section}>
      {/* Own decks */}
      {ownDecks.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={deckStyles.list}>
            {ownDecks.map((deck) => (
              <Pressable key={deck.id} style={deckStyles.chip} onPress={() => onSelect(deck)}>
                <Text style={deckStyles.chipName}>{deck.name}</Text>
                {deck.commander1 && <Text style={deckStyles.chipCmd} numberOfLines={1}>{deck.commander1}</Text>}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Browse all toggle */}
      {otherDecks.length > 0 && (
        <>
          <Pressable onPress={() => setShowAll(!showAll)} style={deckStyles.browseToggle}>
            <Text style={deckStyles.browseText}>
              {showAll ? "Hide other decks" : `Browse all group decks (${otherDecks.length})`}
            </Text>
          </Pressable>
          {showAll && (
            <View style={deckStyles.allList}>
              {otherDecks.map((deck) => (
                <Pressable key={deck.id} style={deckStyles.allChip} onPress={() => onSelect(deck)}>
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

      {ownDecks.length === 0 && otherDecks.length === 0 && (
        <Text style={deckStyles.none}>No {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format} decks</Text>
      )}
    </View>
  );
}

const deckStyles = StyleSheet.create({
  section: { marginTop: spacing.sm, marginLeft: spacing.xl },
  selected: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontSize: fontSize.md, color: colors.amber, fontWeight: "600" },
  cmd: { fontSize: fontSize.sm, color: colors.textMuted },
  borrowed: { fontSize: fontSize.sm, color: colors.blue, fontStyle: "italic" },
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
});

export default function GameSetupScreen() {
  const router = useRouter();
  const { startNewGame } = useGame();
  const { isAuthenticated } = useAuth();

  const [format, setFormat] = useState("commander");
  const [showAllFormats, setShowAllFormats] = useState(false);

  // Server data
  const [playgroups, setPlaygroups] = useState<Playgroup[]>([]);
  const [selectedPlaygroupId, setSelectedPlaygroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlaygroupMember[]>([]);
  const [playgroupPlayers, setPlaygroupPlayers] = useState<PlaygroupPlayer[]>([]);
  const [userDecks, setUserDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);

  // Player slots
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([
    { key: "1", name: "Player 1", availableDecks: [], source: "guest" },
    { key: "2", name: "Player 2", availableDecks: [], source: "guest" },
    { key: "3", name: "Player 3", availableDecks: [], source: "guest" },
    { key: "4", name: "Player 4", availableDecks: [], source: "guest" },
  ]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  // Load playgroups on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch<{ playgroups: Playgroup[] }>("/api/v1/playgroups")
      .then((data) => setPlaygroups(data.playgroups))
      .catch(() => {});
  }, [isAuthenticated]);

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
        if (data.playgroup.defaultFormat) {
          setFormat(data.playgroup.defaultFormat);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlaygroupId]);

  // Load user's own decks
  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch<{ decks: Deck[] }>("/api/v1/decks")
      .then((data) => setUserDecks(data.decks))
      .catch(() => {});
  }, [isAuthenticated]);

  const addMemberAsPlayer = (member: PlaygroupMember) => {
    const memberDecks = (member.user.decks ?? []).map((d) => ({
      ...d,
      decklistUrl: null,
    }));
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `m-${member.user.id}`,
        name: member.user.username,
        userId: member.user.id,
        availableDecks: memberDecks,
        source: "member",
      },
    ]);
    setShowAddPlayer(false);
  };

  const addPlaygroupPlayerAsPlayer = (pp: PlaygroupPlayer) => {
    const ppDecks = pp.decks.filter((d) => d.format === format || !format);
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `pp-${pp.id}`,
        name: pp.linkedUser?.username ?? pp.name,
        playgroupPlayerId: pp.id,
        userId: pp.linkedUser?.id,
        availableDecks: ppDecks as Deck[],
        source: "player",
      },
    ]);
    setShowAddPlayer(false);
  };

  const addGuestPlayer = () => {
    const num = playerSlots.length + 1;
    setPlayerSlots((prev) => [
      ...prev,
      {
        key: `g-${Date.now()}`,
        name: `Player ${num}`,
        availableDecks: [],
        source: "guest",
      },
    ]);
    setShowAddPlayer(false);
  };

  const removePlayer = (key: string) => {
    setPlayerSlots((prev) => prev.filter((p) => p.key !== key));
  };

  const updatePlayerName = (key: string, name: string) => {
    setPlayerSlots((prev) =>
      prev.map((p) => (p.key === key ? { ...p, name } : p))
    );
  };

  const selectDeck = (playerKey: string, deck: Deck) => {
    setPlayerSlots((prev) =>
      prev.map((p) =>
        p.key === playerKey
          ? {
              ...p,
              deckId: deck.id,
              commanderUsed1: deck.commander1 ?? undefined,
              commanderUsed2: deck.commander2 ?? undefined,
              bracketUsed: deck.bracket ?? undefined,
            }
          : p
      )
    );
  };

  const clearDeck = (playerKey: string) => {
    setPlayerSlots((prev) =>
      prev.map((p) =>
        p.key === playerKey
          ? { ...p, deckId: undefined, commanderUsed1: undefined, commanderUsed2: undefined, bracketUsed: undefined }
          : p
      )
    );
  };

  // Collect ALL decks from all members + playgroup players for the "browse all" option
  const allGroupDecks: (Deck & { ownerName: string })[] = (() => {
    const decks: (Deck & { ownerName: string })[] = [];
    for (const m of members) {
      for (const d of m.user.decks ?? []) {
        decks.push({ id: d.id, name: d.name, format: d.format, commander1: d.commander1, commander2: d.commander2, bracket: d.bracket, ownerName: m.user.username });
      }
    }
    for (const pp of playgroupPlayers) {
      for (const d of pp.decks) {
        decks.push({ id: d.id, name: d.name, format: d.format, commander1: d.commander1, commander2: d.commander2, bracket: null, ownerName: pp.linkedUser?.username ?? pp.name });
      }
    }
    return decks;
  })();

  // Players already added (to filter from available list)
  const addedUserIds = new Set(playerSlots.map((p) => p.userId).filter(Boolean));
  const addedPPIds = new Set(playerSlots.map((p) => p.playgroupPlayerId).filter(Boolean));

  const availableMembers = members.filter((m) => !addedUserIds.has(m.user.id));
  const availablePPs = playgroupPlayers.filter((pp) => !addedPPIds.has(pp.id) && !addedUserIds.has(pp.linkedUser?.id));

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
    router.replace("/game/play");
  };

  const startingLife = getStartingLife(format);
  const formatsToShow = showAllFormats ? MTG_FORMATS : POPULAR_FORMATS;

  return (
    <>
      <Stack.Screen options={{
        title: "New Game",
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Playgroup Selection */}
        {isAuthenticated && playgroups.length > 0 && (
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
                    // Reset to guest players
                    setPlayerSlots([
                      { key: "1", name: "Player 1", availableDecks: [], source: "guest" },
                      { key: "2", name: "Player 2", availableDecks: [], source: "guest" },
                      { key: "3", name: "Player 3", availableDecks: [], source: "guest" },
                      { key: "4", name: "Player 4", availableDecks: [], source: "guest" },
                    ]);
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
                    onChangeText={(text) => updatePlayerName(slot.key, text)}
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
              {slot.source !== "guest" && (
                <DeckPicker
                  slot={slot}
                  format={format}
                  allGroupDecks={allGroupDecks}
                  onSelect={(deck) => selectDeck(slot.key, deck)}
                  onClear={() => clearDeck(slot.key)}
                />
              )}

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
                      onPress={() => addMemberAsPlayer(m)}
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
                      onPress={() => addPlaygroupPlayerAsPlayer(pp)}
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
              <Pressable style={styles.addOption} onPress={addGuestPlayer}>
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

        {/* Start Button */}
        <Pressable
          style={[
            styles.startButton,
            playerSlots.length < 2 && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={playerSlots.length < 2}
        >
          <Text style={styles.startButtonText}>Start Game</Text>
        </Pressable>
      </ScrollView>
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
