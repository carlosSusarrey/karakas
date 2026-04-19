import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FORMAT_LABELS } from "@karakas/shared";
import { useAuth } from "../../../src/contexts/auth-context";
import { apiFetch } from "../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../src/constants/theme";

type GameSummary = {
  id: string;
  format: string;
  totalTurns: number | null;
  playedAt: string;
  players: {
    id: string;
    isWinner: boolean;
    placement: number | null;
    guestName: string | null;
    user: { id: string; username: string } | null;
    playgroupPlayer: { id: string; name: string } | null;
    deck: { id: string; name: string; commander1: string | null } | null;
  }[];
  playgroup: { id: string; name: string } | null;
  _count: { powerPlays: number };
};

export default function GamesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<{ games: GameSummary[] }>("/api/v1/games");
      setGames(data.games);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadGames(); }, [loadGames]);

  const onRefresh = () => { setRefreshing(true); loadGames(); };

  const getPlayerName = (p: GameSummary["players"][0]) =>
    p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown";

  const getWinner = (game: GameSummary) => {
    const winner = game.players.find((p) => p.isWinner);
    return winner ? getPlayerName(winner) : null;
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: "Games", headerRight: () => (
          <Pressable onPress={() => router.push("/game/setup")}><Ionicons name="add-circle-outline" size={24} color={colors.amber} /></Pressable>
        ) }} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sign in to see your game history</Text>
          <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Games", headerRight: () => (
        <Pressable onPress={() => router.push("/game/setup")}><Ionicons name="add-circle-outline" size={24} color={colors.amber} /></Pressable>
      ) }} />
      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.amber} /></View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          contentContainerStyle={games.length === 0 ? styles.empty : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No games yet. Start one from the Home tab!</Text>}
          renderItem={({ item: game }) => {
            const winner = getWinner(game);
            const date = new Date(game.playedAt);
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/(tabs)/games/${game.id}` as never)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.format}>
                    {FORMAT_LABELS[game.format as keyof typeof FORMAT_LABELS] ?? game.format}
                  </Text>
                  <Text style={styles.date}>
                    {date.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.players}>
                  {game.players.map(getPlayerName).join(", ")}
                </Text>
                {winner && (
                  <Text style={styles.winner}>Winner: {winner}</Text>
                )}
                {game.playgroup && (
                  <Text style={styles.playgroup}>{game.playgroup.name}</Text>
                )}
                <View style={styles.cardFooter}>
                  {game.totalTurns && <Text style={styles.meta}>{game.totalTurns} turns</Text>}
                  {game._count.powerPlays > 0 && (
                    <Text style={styles.meta}>{game._count.powerPlays} power plays</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: fontSize.lg, textAlign: "center" },
  signInButton: { marginTop: spacing.md, backgroundColor: colors.amber, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: 8 },
  signInText: { color: colors.background, fontWeight: "bold", fontSize: fontSize.lg },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  format: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.md },
  date: { color: colors.textMuted, fontSize: fontSize.sm },
  players: { color: colors.text, fontSize: fontSize.md, marginBottom: spacing.xs },
  winner: { color: colors.green, fontSize: fontSize.md, fontWeight: "600" },
  playgroup: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  cardFooter: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.sm },
});
