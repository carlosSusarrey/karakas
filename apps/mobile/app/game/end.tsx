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
import {
  buildCompleteGameRequest,
  rematchSetup,
  type CompleteGameResponse,
  type GameState,
} from "@karakas/shared";
import { useGame } from "../../src/contexts/game-context";
import { useAuth } from "../../src/contexts/auth-context";
import { apiFetch } from "../../src/lib/api";
import { saveSetupDraft } from "../../src/lib/setup-draft";
import { colors, spacing, fontSize } from "../../src/constants/theme";

type Saved = {
  gameId: string | null;
  resultLabel: string;
  finishedState: GameState;
  createdDecks: CompleteGameResponse["createdDecks"];
};

export default function EndGameScreen() {
  const router = useRouter();
  const { state, endActiveGame } = useGame();
  const { isAuthenticated } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const alivePlayers = state.players.filter((p) => !p.isEliminated);
  const winnerCandidates = showAllPlayers || alivePlayers.length === 0 ? state.players : alivePlayers;
  const eliminatedPlayers = state.players
    .filter((p) => p.isEliminated)
    .sort((a, b) => (b.eliminatedTurn ?? 0) - (a.eliminatedTurn ?? 0));

  const finish = async (winnerPlayerId: string | null, isDraw: boolean) => {
    if (saving) return;
    setError(null);
    const finishedState = state;
    const winner = finishedState.players.find((p) => p.id === winnerPlayerId);
    const resultLabel = isDraw ? "It's a draw" : `${winner?.name ?? "Winner"} wins!`;

    if (!isAuthenticated) {
      endActiveGame();
      setSaved({ gameId: null, resultLabel, finishedState, createdDecks: [] });
      return;
    }

    setSaving(true);
    try {
      const { game, createdDecks } = await apiFetch<CompleteGameResponse>("/api/v1/games/complete", {
        method: "POST",
        body: JSON.stringify(buildCompleteGameRequest(finishedState, { winnerPlayerId, isDraw })),
      });
      endActiveGame();
      setSaved({ gameId: game.id, resultLabel, finishedState, createdDecks });
    } catch (e) {
      // The game stays saved on the device, so the user can retry
      setError(e instanceof Error ? e.message : "Failed to save game.");
    } finally {
      setSaving(false);
    }
  };

  const handleRematch = async () => {
    if (!saved) return;
    await saveSetupDraft({
      format: saved.finishedState.format,
      playgroupId: saved.finishedState.playgroupId,
      players: rematchSetup(saved.finishedState, saved.createdDecks),
      rematch: true,
    });
    router.replace("/game/setup?rematch=1");
  };

  if (saved) {
    return (
      <>
        <Stack.Screen options={{ title: "Game Over" }} />
        <View style={[styles.container, styles.resultContent]}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.resultTitle}>{saved.resultLabel}</Text>
          <Text style={styles.resultSub}>
            {saved.gameId ? "Game saved." : "Sign in to save game results to your account."}
          </Text>

          <Pressable style={styles.submitButton} onPress={handleRematch}>
            <View style={styles.rematchInner}>
              <Ionicons name="repeat" size={20} color={colors.background} />
              <Text style={styles.submitText}>Rematch</Text>
            </View>
          </Pressable>
          {saved.gameId && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace(`/games/${saved.gameId}/edit`)}
            >
              <Text style={styles.secondaryText}>Add details or fix result</Text>
            </Pressable>
          )}
          <Pressable style={styles.doneButton} onPress={() => router.replace("/")}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Who won?" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.summary}>
          Turn {state.currentTurn} · {state.format} · tap the winner to save
        </Text>

        <View style={styles.section}>
          {winnerCandidates.map((player) => (
            <Pressable
              key={player.id}
              style={[styles.playerRow, saving && styles.submitButtonDisabled]}
              disabled={saving}
              onPress={() => finish(player.id, false)}
            >
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerLife}>
                {player.isEliminated ? "eliminated" : `${player.lifeTotal} life`}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.drawButton, saving && styles.submitButtonDisabled]}
            disabled={saving}
            onPress={() => finish(null, true)}
          >
            <Text style={styles.drawText}>Draw</Text>
          </Pressable>
          {!showAllPlayers && eliminatedPlayers.length > 0 && alivePlayers.length > 0 && (
            <Pressable style={styles.drawButton} onPress={() => setShowAllPlayers(true)}>
              <Text style={styles.drawText}>Someone else won</Text>
            </Pressable>
          )}
        </View>

        {saving && <ActivityIndicator color={colors.amber} style={{ marginBottom: spacing.lg }} />}
        {error && (
          <Pressable onPress={() => Alert.alert("Couldn't save", error)}>
            <Text style={styles.errorText}>{error} — tap the winner again to retry.</Text>
          </Pressable>
        )}

        {/* Elimination order */}
        {eliminatedPlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eliminated</Text>
            {eliminatedPlayers.map((player) => (
              <View key={player.id} style={styles.eliminatedRow}>
                <Text style={styles.eliminatedName}>{player.name}</Text>
                <Text style={styles.eliminatedTurn}>
                  Turn {player.eliminatedTurn}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  resultContent: { padding: spacing.lg, justifyContent: "center" },
  trophy: { fontSize: 56, textAlign: "center", marginBottom: spacing.md },
  resultTitle: { fontSize: fontSize["2xl"], fontWeight: "bold", color: colors.text, textAlign: "center" },
  resultSub: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  rematchInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.md,
  },
  secondaryText: { fontSize: fontSize.lg, color: colors.text, fontWeight: "600" },
  doneButton: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm },
  doneText: { fontSize: fontSize.lg, color: colors.textSecondary },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  errorText: { fontSize: fontSize.md, color: colors.red, marginBottom: spacing.lg },
  summary: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  drawButton: {
    flex: 1,
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
