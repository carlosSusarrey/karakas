import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useAuth } from "../../../../src/contexts/auth-context";
import { apiFetch } from "../../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../../src/constants/theme";

type Member = { id: string; role: string; user: { id: string; username: string; email: string } };
type Player = { id: string; name: string; email: string | null; linkedUser: { id: string; username: string } | null };
type PlaygroupDetail = {
  id: string; name: string; description: string | null; defaultFormat: string | null; ownerId: string;
  members: Member[]; players: Player[];
};

export default function PlaygroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [pg, setPg] = useState<PlaygroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ playgroup: PlaygroupDetail }>(`/api/v1/playgroups/${id}`);
      setPg(data.playgroup);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const myMembership = pg?.members.find((m) => m.user.id === user?.id);
  const isAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await apiFetch(`/api/v1/playgroups/${id}/invite`, { method: "POST", body: JSON.stringify({ email: inviteEmail.trim() }) });
      Alert.alert("Invited", `Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail(""); setShowInvite(false); load();
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    try {
      await apiFetch(`/api/v1/playgroups/${id}/players`, { method: "POST", body: JSON.stringify({ name: newPlayerName.trim(), email: newPlayerEmail.trim() || null }) });
      setNewPlayerName(""); setNewPlayerEmail(""); setShowAddPlayer(false); load();
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleClaimPlayer = async (playerId: string) => {
    Alert.alert("Claim Player", "Link this player to your account? Their game history will merge with yours.", [
      { text: "Cancel", style: "cancel" },
      { text: "Claim", onPress: async () => {
        try {
          await apiFetch(`/api/v1/playgroups/${id}/players/${playerId}/claim`, { method: "POST" });
          load();
        } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  const handleRemovePlayer = async (playerId: string) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await apiFetch(`/api/v1/playgroups/${id}/players/${playerId}`, { method: "DELETE" });
          load();
        } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert("Remove Member", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await apiFetch(`/api/v1/playgroups/${id}/members/${memberId}`, { method: "DELETE" });
          load();
        } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  if (loading) return <View style={styles.empty}><ActivityIndicator color={colors.amber} /></View>;
  if (!pg) return <View style={styles.empty}><Text style={styles.emptyText}>Playgroup not found</Text></View>;

  return (
    <>
      <Stack.Screen options={{ title: pg.name }} />
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.amber} />}>
        {pg.description && <Text style={styles.desc}>{pg.description}</Text>}

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({pg.members.length})</Text>
            {isAdmin && (
              <Pressable onPress={() => setShowInvite(!showInvite)}>
                <Text style={styles.addText}>+ Invite</Text>
              </Pressable>
            )}
          </View>
          {showInvite && (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.textMuted} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" />
              <Pressable style={styles.smallButton} onPress={handleInvite}><Text style={styles.smallButtonText}>Send</Text></Pressable>
            </View>
          )}
          {pg.members.map((m) => (
            <View key={m.id} style={styles.row}>
              <Text style={styles.rowName}>{m.user.username}</Text>
              <Text style={styles.roleBadge}>{m.role}</Text>
              {isAdmin && m.role !== "owner" && m.user.id !== user?.id && (
                <Pressable onPress={() => handleRemoveMember(m.id)}><Text style={styles.removeText}>Remove</Text></Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Players */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Players ({pg.players.length})</Text>
            <Pressable onPress={() => setShowAddPlayer(!showAddPlayer)}>
              <Text style={styles.addText}>+ Add</Text>
            </Pressable>
          </View>
          {showAddPlayer && (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Player name" placeholderTextColor={colors.textMuted} value={newPlayerName} onChangeText={setNewPlayerName} />
              <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor={colors.textMuted} value={newPlayerEmail} onChangeText={setNewPlayerEmail} keyboardType="email-address" autoCapitalize="none" />
              <Pressable style={styles.smallButton} onPress={handleAddPlayer}><Text style={styles.smallButtonText}>Add</Text></Pressable>
            </View>
          )}
          {pg.players.length === 0 && <Text style={styles.emptyText}>No unlinked players</Text>}
          {pg.players.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{p.name}</Text>
                {p.linkedUser && <Text style={styles.linkedText}>Linked to {p.linkedUser.username}</Text>}
              </View>
              {!p.linkedUser && (
                <Pressable onPress={() => handleClaimPlayer(p.id)}><Text style={styles.claimText}>Claim</Text></Pressable>
              )}
              {isAdmin && (
                <Pressable onPress={() => handleRemovePlayer(p.id)}><Text style={styles.removeText}>Remove</Text></Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },
  desc: { color: colors.textSecondary, fontSize: fontSize.md, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  addText: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.md },
  inlineForm: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, gap: spacing.sm, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceLight, borderRadius: 6, padding: spacing.sm, color: colors.text, fontSize: fontSize.md },
  smallButton: { backgroundColor: colors.amber, padding: spacing.sm, borderRadius: 6, alignItems: "center" },
  smallButtonText: { color: colors.background, fontWeight: "bold" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  rowName: { flex: 1, color: colors.text, fontSize: fontSize.md },
  roleBadge: { color: colors.amber, fontSize: fontSize.sm, fontWeight: "600" },
  linkedText: { color: colors.textMuted, fontSize: fontSize.sm },
  claimText: { color: colors.blue, fontSize: fontSize.sm, fontWeight: "600" },
  removeText: { color: colors.red, fontSize: fontSize.sm },
});
