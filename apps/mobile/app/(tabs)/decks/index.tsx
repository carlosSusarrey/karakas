import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MTG_FORMATS, FORMAT_LABELS, isCommanderFormat, hasBrackets } from "@karakas/shared";
import { useAuth } from "../../../src/contexts/auth-context";
import { apiFetch } from "../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../src/constants/theme";

type Deck = {
  id: string; name: string; format: string; commander1: string | null; commander2: string | null;
  bracket: number | null; decklistUrl: string | null; isActive: boolean;
};

export default function DecksScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const [commander1, setCommander1] = useState("");
  const [commander2, setCommander2] = useState("");
  const [bracket, setBracket] = useState<number | null>(null);
  const [decklistUrl, setDecklistUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<{ decks: Deck[] }>("/api/v1/decks");
      setDecks(data.decks);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Error", "Deck name is required"); return; }
    setCreating(true);
    try {
      await apiFetch("/api/v1/decks", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(), format,
          commander1: commander1.trim() || null, commander2: commander2.trim() || null,
          bracket, decklistUrl: decklistUrl.trim() || null,
        }),
      });
      setShowCreate(false);
      setName(""); setCommander1(""); setCommander2(""); setBracket(null); setDecklistUrl("");
      load();
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  };

  const handleDelete = (deck: Deck) => {
    Alert.alert("Delete Deck", `Delete "${deck.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await apiFetch(`/api/v1/decks/${deck.id}`, { method: "DELETE" }); load(); }
        catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  if (!isAuthenticated) {
    return (
      <><Stack.Screen options={{ title: "Decks" }} />
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sign in to manage decks</Text>
        <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}><Text style={styles.signInText}>Sign In</Text></Pressable>
      </View></>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: "Decks",
        headerRight: () => <Pressable onPress={() => setShowCreate(!showCreate)}><Text style={{ color: colors.amber, fontSize: fontSize.lg, fontWeight: "bold" }}>+</Text></Pressable>,
      }} />

      {showCreate && (
        <ScrollView style={styles.createPanel} contentContainerStyle={{ gap: spacing.sm, padding: spacing.md }}>
          <TextInput style={styles.input} placeholder="Deck name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
          <View style={styles.formatRow}>
            {(["commander", "modern", "standard", "pioneer", "legacy", "pauper", "draft"] as const).map((f) => (
              <Pressable key={f} style={[styles.chip, format === f && styles.chipActive]} onPress={() => setFormat(f)}>
                <Text style={[styles.chipText, format === f && styles.chipTextActive]}>{FORMAT_LABELS[f]}</Text>
              </Pressable>
            ))}
          </View>
          {isCommanderFormat(format) && (
            <>
              <TextInput style={styles.input} placeholder="Commander" placeholderTextColor={colors.textMuted} value={commander1} onChangeText={setCommander1} />
              <TextInput style={styles.input} placeholder="Partner (optional)" placeholderTextColor={colors.textMuted} value={commander2} onChangeText={setCommander2} />
            </>
          )}
          {hasBrackets(format) && (
            <View style={styles.formatRow}>
              {[1,2,3,4,5].map((b) => (
                <Pressable key={b} style={[styles.bracketChip, bracket === b && styles.chipActive]} onPress={() => setBracket(b)}>
                  <Text style={[styles.chipText, bracket === b && styles.chipTextActive]}>B{b}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput style={styles.input} placeholder="Decklist URL (optional)" placeholderTextColor={colors.textMuted} value={decklistUrl} onChangeText={setDecklistUrl} autoCapitalize="none" />
          <Pressable style={[styles.createButton, creating && { opacity: 0.5 }]} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? "Creating..." : "Create Deck"}</Text>
          </Pressable>
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.amber} /></View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(d) => d.id}
          contentContainerStyle={decks.length === 0 ? styles.empty : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.amber} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No decks yet. Create one!</Text>}
          renderItem={({ item: deck }) => (
            <Pressable style={styles.card} onLongPress={() => handleDelete(deck)}>
              <View style={styles.cardHeader}>
                <Text style={styles.deckName}>{deck.name}</Text>
                <Text style={styles.format}>{FORMAT_LABELS[deck.format as keyof typeof FORMAT_LABELS] ?? deck.format}</Text>
              </View>
              {deck.commander1 && <Text style={styles.commander}>{deck.commander1}{deck.commander2 ? ` / ${deck.commander2}` : ""}</Text>}
              {deck.bracket && <Text style={styles.bracket}>Bracket {deck.bracket}</Text>}
            </Pressable>
          )}
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
  createPanel: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 350 },
  input: { backgroundColor: colors.surfaceLight, borderRadius: 8, padding: spacing.md, color: colors.text, fontSize: fontSize.md },
  formatRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberDark + "33" },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm },
  chipTextActive: { color: colors.amber, fontWeight: "bold" },
  bracketChip: { width: 40, paddingVertical: spacing.xs, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  createButton: { backgroundColor: colors.amber, padding: spacing.md, borderRadius: 8, alignItems: "center" },
  createButtonText: { color: colors.background, fontWeight: "bold", fontSize: fontSize.md },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deckName: { color: colors.text, fontSize: fontSize.lg, fontWeight: "bold", flex: 1 },
  format: { color: colors.amber, fontSize: fontSize.sm, fontWeight: "600" },
  commander: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: spacing.xs },
  bracket: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
});
