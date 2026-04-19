import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FORMAT_LABELS } from "@karakas/shared";
import { apiFetch } from "../../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../../src/constants/theme";

type GamePlayer = {
  id: string;
  placement: number | null;
  isWinner: boolean;
  isFirstOut: boolean;
  eliminatedTurn: number | null;
  guestName: string | null;
  commanderUsed1: string | null;
  commanderUsed2: string | null;
  bracketUsed: number | null;
  user: { id: string; username: string } | null;
  playgroupPlayer: { id: string; name: string } | null;
  deck: { id: string; name: string; commander1: string | null } | null;
};

type GameDetail = {
  id: string;
  format: string;
  totalTurns: number | null;
  notes: string | null;
  players: GamePlayer[];
};

export default function EditGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [totalTurns, setTotalTurns] = useState("");
  const [notes, setNotes] = useState("");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);

  useEffect(() => {
    apiFetch<{ game: GameDetail }>(`/api/v1/games/${id}`)
      .then((data) => {
        setGame(data.game);
        setTotalTurns(data.game.totalTurns?.toString() ?? "");
        setNotes(data.game.notes ?? "");
        const winner = data.game.players.find((p) => p.isWinner);
        if (winner) {
          setWinnerId(winner.id);
        } else if (data.game.players.every((p) => p.placement === 1)) {
          setIsDraw(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const getPlayerName = (p: GamePlayer) =>
    p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown";

  const handleSave = async () => {
    if (!game) return;
    setSaving(true);
    try {
      // Update game metadata
      await apiFetch(`/api/v1/games/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          totalTurns: totalTurns ? parseInt(totalTurns) : null,
          notes: notes.trim() || null,
        }),
      });

      // Re-end the game with new winner
      await apiFetch(`/api/v1/games/${id}/end`, {
        method: "POST",
        body: JSON.stringify({
          winnerId: isDraw ? null : winnerId,
          isDraw,
          totalTurns: totalTurns ? parseInt(totalTurns) : null,
        }),
      });

      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;
  if (!game) return <View style={styles.center}><Text style={styles.muted}>Game not found</Text></View>;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Game" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Format (read-only) */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Format</Text>
          <Text style={styles.value}>{FORMAT_LABELS[game.format as keyof typeof FORMAT_LABELS] ?? game.format}</Text>
        </View>

        {/* Total Turns */}
        <View style={styles.field}>
          <Text style={styles.label}>Total Turns</Text>
          <TextInput
            style={styles.input}
            value={totalTurns}
            onChangeText={setTotalTurns}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Game notes..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Winner Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Result</Text>

          <Pressable
            style={[styles.resultOption, isDraw && styles.resultOptionActive]}
            onPress={() => { setIsDraw(!isDraw); if (!isDraw) setWinnerId(null); }}
          >
            <Ionicons name={isDraw ? "checkmark-circle" : "ellipse-outline"} size={22} color={isDraw ? colors.amber : colors.textMuted} />
            <Text style={[styles.resultText, isDraw && styles.resultTextActive]}>Draw</Text>
          </Pressable>

          {!isDraw && game.players.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.resultOption, winnerId === p.id && styles.resultOptionActive]}
              onPress={() => { setWinnerId(p.id); setIsDraw(false); }}
            >
              <Ionicons
                name={winnerId === p.id ? "trophy" : "ellipse-outline"}
                size={22}
                color={winnerId === p.id ? colors.amber : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultText, winnerId === p.id && styles.resultTextActive]}>
                  {getPlayerName(p)}
                </Text>
                {p.deck && (
                  <Text style={styles.resultSub}>{p.deck.name}</Text>
                )}
              </View>
              {p.commanderUsed1 && (
                <Text style={styles.cmdText}>{p.commanderUsed1}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Players (read-only info) */}
        <View style={styles.field}>
          <Text style={styles.label}>Players</Text>
          {game.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{getPlayerName(p)}</Text>
              {p.deck && <Text style={styles.deckInfo}>{p.deck.name}</Text>}
              {p.eliminatedTurn && <Text style={styles.elimInfo}>Elim. T{p.eliminatedTurn}</Text>}
            </View>
          ))}
        </View>

        {/* Save */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </Pressable>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  muted: { color: colors.textMuted, fontSize: fontSize.lg },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  field: { marginBottom: spacing.xl },
  label: { fontSize: fontSize.md, fontWeight: "bold", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
  value: { fontSize: fontSize.lg, color: colors.amber, fontWeight: "600" },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: spacing.md, paddingHorizontal: spacing.md, fontSize: fontSize.lg, color: colors.text },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  resultOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.sm },
  resultOptionActive: { borderColor: colors.amber, backgroundColor: colors.amberDark + "22" },
  resultText: { fontSize: fontSize.lg, color: colors.text },
  resultTextActive: { color: colors.amber, fontWeight: "bold" },
  resultSub: { fontSize: fontSize.sm, color: colors.textMuted },
  cmdText: { fontSize: fontSize.sm, color: colors.textMuted },
  playerRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  playerName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  deckInfo: { fontSize: fontSize.sm, color: colors.textSecondary },
  elimInfo: { fontSize: fontSize.sm, color: colors.red },
  saveButton: { backgroundColor: colors.amber, paddingVertical: spacing.md, borderRadius: 12, alignItems: "center", marginTop: spacing.md },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.background },
});
