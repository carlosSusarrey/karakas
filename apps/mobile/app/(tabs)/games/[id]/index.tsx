import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Pressable, RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FORMAT_LABELS, POWER_PLAY_LABELS } from "@karakas/shared";
import { useAuth } from "../../../../src/contexts/auth-context";
import { apiFetch } from "../../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../../src/constants/theme";

type GameDetail = {
  id: string;
  format: string;
  totalTurns: number | null;
  notes: string | null;
  playedAt: string;
  createdBy: { id: string; username: string };
  playgroup: { id: string; name: string } | null;
  players: {
    id: string;
    placement: number | null;
    isWinner: boolean;
    isFirstOut: boolean;
    eliminatedTurn: number | null;
    guestName: string | null;
    commanderUsed1: string | null;
    commanderUsed2: string | null;
    bracketUsed: number | null;
    user: { id: string; username: string; avatarUrl: string | null } | null;
    playgroupPlayer: { id: string; name: string } | null;
    deck: { id: string; name: string; commander1: string | null; commander2: string | null } | null;
    playgroupPlayerDeck: { id: string; name: string; commander1: string | null; commander2: string | null } | null;
  }[];
  powerPlays: {
    id: string;
    turn: number;
    type: string;
    description: string;
    cardName: string | null;
    gamePlayerId: string;
  }[];
};

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGame = useCallback(() => {
    setLoading(true);
    apiFetch<{ game: GameDetail }>(`/api/v1/games/${id}`)
      .then((data) => setGame(data.game))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { loadGame(); }, [loadGame]));

  const getPlayerName = (p: GameDetail["players"][0]) =>
    p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown";

  const getDeckInfo = (p: GameDetail["players"][0]) => {
    const deck = p.deck ?? p.playgroupPlayerDeck;
    const cmd = p.commanderUsed1 ?? deck?.commander1;
    return { name: deck?.name, commander: cmd };
  };

  const handleDelete = () => {
    Alert.alert("Delete Game", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiFetch(`/api/v1/games/${id}`, { method: "DELETE" });
          router.back();
        } catch (e) {
          Alert.alert("Error", e instanceof Error ? e.message : "Failed");
        }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;
  if (!game) return <View style={styles.center}><Text style={styles.muted}>Game not found</Text></View>;

  const date = new Date(game.playedAt);
  const sortedPlayers = [...game.players].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const isCreator = user?.id === game.createdBy.id;

  return (
    <>
      <Stack.Screen options={{
        title: FORMAT_LABELS[game.format as keyof typeof FORMAT_LABELS] ?? game.format,
        headerRight: isCreator ? () => (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={() => router.push(`/(tabs)/games/${id}/edit` as never)}>
              <Ionicons name="pencil" size={20} color={colors.amber} />
            </Pressable>
            <Pressable onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
            </Pressable>
          </View>
        ) : undefined,
      }} />
      <ScrollView style={styles.container}>
        {/* Header info */}
        <View style={styles.headerCard}>
          <Text style={styles.date}>{date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
          {game.playgroup && <Text style={styles.playgroup}>{game.playgroup.name}</Text>}
          <View style={styles.metaRow}>
            {game.totalTurns && <Text style={styles.meta}>{game.totalTurns} turns</Text>}
            <Text style={styles.meta}>{game.players.length} players</Text>
            {game.powerPlays.length > 0 && <Text style={styles.meta}>{game.powerPlays.length} power plays</Text>}
          </View>
        </View>

        {/* Players */}
        <Text style={styles.sectionTitle}>Players</Text>
        {sortedPlayers.map((p, i) => {
          const deckInfo = getDeckInfo(p);
          return (
            <View key={p.id} style={[styles.playerCard, p.isWinner && styles.winnerCard]}>
              <View style={styles.playerHeader}>
                <View style={styles.placementBadge}>
                  <Text style={styles.placementText}>
                    {p.isWinner ? "1st" : p.placement ? `${p.placement}${p.placement === 2 ? "nd" : p.placement === 3 ? "rd" : "th"}` : "—"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.playerName, p.isWinner && styles.winnerName]}>
                    {getPlayerName(p)} {p.isWinner ? "  (Winner)" : ""}
                  </Text>
                  {deckInfo.name && <Text style={styles.deckName}>{deckInfo.name}</Text>}
                  {deckInfo.commander && <Text style={styles.commander}>{deckInfo.commander}{p.commanderUsed2 ? ` / ${p.commanderUsed2}` : ""}</Text>}
                </View>
              </View>
              {p.isFirstOut && <Text style={styles.firstOut}>First eliminated</Text>}
              {p.eliminatedTurn && !p.isFirstOut && <Text style={styles.eliminated}>Eliminated turn {p.eliminatedTurn}</Text>}
              {p.bracketUsed && <Text style={styles.bracket}>Bracket {p.bracketUsed}</Text>}
            </View>
          );
        })}

        {/* Power Plays */}
        {game.powerPlays.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Power Plays</Text>
            {game.powerPlays.map((pp) => {
              const player = game.players.find((p) => p.id === pp.gamePlayerId);
              return (
                <View key={pp.id} style={styles.ppCard}>
                  <View style={styles.ppHeader}>
                    <Text style={styles.ppTurn}>T{pp.turn}</Text>
                    <Text style={styles.ppType}>
                      {POWER_PLAY_LABELS[pp.type as keyof typeof POWER_PLAY_LABELS] ?? pp.type}
                    </Text>
                    <Text style={styles.ppPlayer}>{player ? getPlayerName(player) : ""}</Text>
                  </View>
                  <Text style={styles.ppDesc}>{pp.description}</Text>
                  {pp.cardName && <Text style={styles.ppCard2}>{pp.cardName}</Text>}
                </View>
              );
            })}
          </>
        )}

        {/* Notes */}
        {game.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{game.notes}</Text>
          </>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  muted: { color: colors.textMuted, fontSize: fontSize.lg },
  headerCard: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  date: { color: colors.text, fontSize: fontSize.lg, fontWeight: "600" },
  playgroup: { color: colors.amber, fontSize: fontSize.md, marginTop: spacing.xs },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },
  playerCard: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  winnerCard: { borderColor: colors.amber, backgroundColor: colors.amberDark + "15" },
  playerHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  placementBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, justifyContent: "center", alignItems: "center" },
  placementText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "bold" },
  playerName: { color: colors.text, fontSize: fontSize.lg, fontWeight: "600" },
  winnerName: { color: colors.amber },
  deckName: { color: colors.textSecondary, fontSize: fontSize.md },
  commander: { color: colors.textMuted, fontSize: fontSize.sm },
  firstOut: { color: colors.red, fontSize: fontSize.sm, marginTop: spacing.xs, marginLeft: 52 },
  eliminated: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, marginLeft: 52 },
  bracket: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, marginLeft: 52 },
  ppCard: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  ppHeader: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.xs },
  ppTurn: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.sm },
  ppType: { color: colors.text, fontWeight: "600", fontSize: fontSize.md },
  ppPlayer: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1, textAlign: "right" },
  ppDesc: { color: colors.textSecondary, fontSize: fontSize.md },
  ppCard2: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: "italic", marginTop: spacing.xs },
  notes: { color: colors.textSecondary, fontSize: fontSize.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8 },
});
