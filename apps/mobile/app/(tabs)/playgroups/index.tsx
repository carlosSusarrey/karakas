import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MTG_FORMATS, FORMAT_LABELS } from "@karakas/shared";
import { useAuth } from "../../../src/contexts/auth-context";
import { apiFetch } from "../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../src/constants/theme";

type Playgroup = {
  id: string;
  name: string;
  description: string | null;
  defaultFormat: string | null;
  role: string;
  memberCount: number;
  playerCount: number;
  gameCount: number;
};

export default function PlaygroupsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [playgroups, setPlaygroups] = useState<Playgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFormat, setNewFormat] = useState("commander");
  const [creating, setCreating] = useState(false);

  const loadPlaygroups = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch<{ playgroups: Playgroup[] }>("/api/v1/playgroups");
      setPlaygroups(data.playgroups);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadPlaygroups(); }, [loadPlaygroups]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/v1/playgroups", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, defaultFormat: newFormat }),
      });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      loadPlaygroups();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ title: "Playgroups" }} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sign in to manage playgroups</Text>
          <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: "Playgroups",
        headerRight: () => (
          <Pressable onPress={() => setShowCreate(!showCreate)}>
            <Text style={{ color: colors.amber, fontSize: fontSize.lg, fontWeight: "bold" }}>+</Text>
          </Pressable>
        ),
      }} />

      {showCreate && (
        <View style={styles.createPanel}>
          <TextInput style={styles.input} placeholder="Playgroup name" placeholderTextColor={colors.textMuted} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={newDesc} onChangeText={setNewDesc} />
          <View style={styles.formatRow}>
            {(["commander", "modern", "standard"] as const).map((f) => (
              <Pressable key={f} style={[styles.formatChip, newFormat === f && styles.formatChipActive]} onPress={() => setNewFormat(f)}>
                <Text style={[styles.formatChipText, newFormat === f && styles.formatChipTextActive]}>{FORMAT_LABELS[f]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.createButton, creating && { opacity: 0.5 }]} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? "Creating..." : "Create Playgroup"}</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.amber} /></View>
      ) : (
        <FlatList
          data={playgroups}
          keyExtractor={(pg) => pg.id}
          contentContainerStyle={playgroups.length === 0 ? styles.empty : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlaygroups(); }} tintColor={colors.amber} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No playgroups yet. Create one!</Text>}
          renderItem={({ item: pg }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(tabs)/playgroups/${pg.id}` as never)}>
              <Text style={styles.pgName}>{pg.name}</Text>
              {pg.description && <Text style={styles.pgDesc}>{pg.description}</Text>}
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>{pg.memberCount} members</Text>
                <Text style={styles.meta}>{pg.playerCount} players</Text>
                <Text style={styles.meta}>{pg.gameCount} games</Text>
                <Text style={styles.role}>{pg.role}</Text>
              </View>
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
  createPanel: { backgroundColor: colors.surface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  input: { backgroundColor: colors.surfaceLight, borderRadius: 8, padding: spacing.md, color: colors.text, fontSize: fontSize.md },
  formatRow: { flexDirection: "row", gap: spacing.sm },
  formatChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  formatChipActive: { borderColor: colors.amber, backgroundColor: colors.amberDark + "33" },
  formatChipText: { color: colors.textSecondary, fontSize: fontSize.sm },
  formatChipTextActive: { color: colors.amber, fontWeight: "bold" },
  createButton: { backgroundColor: colors.amber, padding: spacing.md, borderRadius: 8, alignItems: "center" },
  createButtonText: { color: colors.background, fontWeight: "bold", fontSize: fontSize.md },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pgName: { color: colors.text, fontSize: fontSize.xl, fontWeight: "bold" },
  pgDesc: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: spacing.xs },
  cardFooter: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" },
  meta: { color: colors.textMuted, fontSize: fontSize.sm },
  role: { color: colors.amber, fontSize: fontSize.sm, fontWeight: "600" },
});
