import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useGame } from "../../src/contexts/game-context";
import { useAuth } from "../../src/contexts/auth-context";
import { apiFetch } from "../../src/lib/api";
import { colors, spacing, fontSize } from "../../src/constants/theme";

export default function EndGameScreen() {
  const router = useRouter();
  const { state, endActiveGame, startNewGame } = useGame();
  const { isAuthenticated } = useAuth();
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [saving, setSaving] = useState(false);

  const alivePlayers = state.players.filter((p) => !p.isEliminated);
  const eliminatedPlayers = state.players
    .filter((p) => p.isEliminated)
    .sort((a, b) => (b.eliminatedTurn ?? 0) - (a.eliminatedTurn ?? 0));

  const handleRematch = () => {
    const players = state.players.map((p) => ({
      name: p.name,
      userId: p.serverUserId,
      playgroupPlayerId: p.serverPlaygroupPlayerId,
      deckId: p.serverDeckId,
      commanderUsed1: p.commanderUsed1,
      commanderUsed2: p.commanderUsed2,
      bracketUsed: p.bracketUsed,
    }));
    startNewGame(state.format, players, state.playgroupId);
    router.replace("/game/play");
  };

  const handleEndGame = async () => {
    if (!isDraw && !winnerId) {
      Alert.alert("Select a winner", "Choose a winner or declare a draw.");
      return;
    }

    if (!isAuthenticated) {
      Alert.alert("Game Complete", "Sign in to save game results to your account.");
      endActiveGame();
      router.replace("/");
      return;
    }

    setSaving(true);
    try {
      // Create game on server with proper player linkage
      const { game } = await apiFetch<{ game: { id: string; players: { id: string }[] } }>("/api/v1/games", {
        method: "POST",
        body: JSON.stringify({
          format: state.format,
          playgroupId: state.playgroupId,
          players: state.players.map((p) => ({
            userId: p.serverUserId || undefined,
            playgroupPlayerId: p.serverPlaygroupPlayerId || undefined,
            deckId: p.serverDeckId || undefined,
            guestName: (!p.serverUserId && !p.serverPlaygroupPlayerId) ? p.name : undefined,
            commanderUsed1: p.commanderUsed1 || undefined,
            commanderUsed2: p.commanderUsed2 || undefined,
            bracketUsed: p.bracketUsed || undefined,
          })),
        }),
      });

      // Map local winnerId to server gamePlayerId
      let serverWinnerId: string | null = null;
      if (!isDraw && winnerId) {
        const winnerIndex = state.players.findIndex((p) => p.id === winnerId);
        if (winnerIndex >= 0 && game.players[winnerIndex]) {
          serverWinnerId = game.players[winnerIndex].id;
        }
      }

      // End the game
      await apiFetch(`/api/v1/games/${game.id}/end`, {
        method: "POST",
        body: JSON.stringify({
          winnerId: serverWinnerId,
          isDraw,
          totalTurns: state.currentTurn,
        }),
      });

      endActiveGame();
      Alert.alert("Game Saved", "Your game has been recorded.", [
        { text: "Done", onPress: () => router.replace("/") },
        {
          text: "Rematch",
          onPress: () => {
            handleRematch();
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save game.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "End Game" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.summary}>
          Turn {state.currentTurn} · {state.format}
        </Text>

        {/* Draw toggle */}
        <Pressable
          style={[styles.drawButton, isDraw && styles.drawButtonActive]}
          onPress={() => {
            setIsDraw(!isDraw);
            setWinnerId(null);
          }}
        >
          <Text style={[styles.drawText, isDraw && styles.drawTextActive]}>
            Declare Draw {isDraw ? "✓" : ""}
          </Text>
        </Pressable>

        {/* Winner selection */}
        {!isDraw && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Winner</Text>
            {alivePlayers.map((player) => (
              <Pressable
                key={player.id}
                style={[
                  styles.playerRow,
                  winnerId === player.id && styles.playerRowSelected,
                ]}
                onPress={() => setWinnerId(player.id)}
              >
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerLife}>{player.lifeTotal} life</Text>
                {winnerId === player.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Elimination order */}
        {eliminatedPlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eliminated</Text>
            {eliminatedPlayers.map((player, i) => (
              <View key={player.id} style={styles.eliminatedRow}>
                <Text style={styles.eliminatedName}>{player.name}</Text>
                <Text style={styles.eliminatedTurn}>
                  Turn {player.eliminatedTurn}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleEndGame}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>
              {isAuthenticated ? "Save & End Game" : "End Game"}
            </Text>
          )}
        </Pressable>

        {/* Rematch button */}
        <Pressable style={styles.rematchButton} onPress={handleRematch}>
          <Ionicons name="repeat" size={20} color={colors.amber} />
          <Text style={styles.rematchText}>Rematch — Same Players</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  summary: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  drawButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  drawButtonActive: {
    borderColor: colors.amber,
    backgroundColor: colors.amberDark + "33",
  },
  drawText: { fontSize: fontSize.lg, color: colors.textSecondary },
  drawTextActive: { color: colors.amber, fontWeight: "bold" },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  playerRowSelected: {
    borderColor: colors.amber,
    backgroundColor: colors.amberDark + "22",
  },
  playerName: { flex: 1, fontSize: fontSize.lg, color: colors.text },
  playerLife: { fontSize: fontSize.md, color: colors.textSecondary, marginRight: spacing.md },
  checkmark: { fontSize: fontSize.xl, color: colors.amber },
  eliminatedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eliminatedName: { fontSize: fontSize.lg, color: colors.textMuted },
  eliminatedTurn: { fontSize: fontSize.md, color: colors.textMuted },
  submitButton: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.background },
  rematchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.amber,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  rematchText: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.amber },
});
