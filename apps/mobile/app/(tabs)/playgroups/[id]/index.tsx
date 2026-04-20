import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FORMAT_LABELS } from "@karakas/shared";
import { useAuth } from "../../../../src/contexts/auth-context";
import { apiFetch } from "../../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../../src/constants/theme";

type Member = { id: string; role: string; user: { id: string; username: string; email: string } };
type Player = { id: string; name: string; email: string | null; linkedUser: { id: string; username: string } | null };
type PlaygroupDetail = {
  id: string; name: string; description: string | null; defaultFormat: string | null; ownerId: string;
  members: Member[]; players: Player[];
};
type GameSummary = {
  id: string; format: string; playedAt: string; totalTurns: number | null;
  players: { isWinner: boolean; guestName: string | null; user: { username: string } | null; playgroupPlayer: { name: string } | null }[];
};

export default function PlaygroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [pg, setPg] = useState<PlaygroupDetail | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = useCallback(async () => {
    try {
      const [pgData, gamesData] = await Promise.all([
        apiFetch<{ playgroup: PlaygroupDetail }>(`/api/v1/playgroups/${id}`),
        apiFetch<{ games: GameSummary[] }>(`/api/v1/games?playgroupId=${id}&limit=500`),
      ]);
      setPg(pgData.playgroup);
      setGames(gamesData.games);
      setEditName(pgData.playgroup.name);
      setEditDesc(pgData.playgroup.description ?? "");
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const myMembership = pg?.members.find((m) => m.user.id === user?.id);
  const isAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";

  // Compute leaderboard from games — use IDs to avoid duplicate entries
  const leaderboard = (() => {
    const stats: Record<string, { name: string; games: number; wins: number }> = {};
    for (const game of games) {
      for (const p of game.players) {
        const playerId = p.user?.username
          ? `user-${p.user.username}`
          : p.playgroupPlayer?.name
            ? `player-${p.playgroupPlayer.name}`
            : `guest-${p.guestName}`;
        const name = p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown";
        if (!stats[playerId]) stats[playerId] = { name, games: 0, wins: 0 };
        stats[playerId].games++;
        if (p.isWinner) stats[playerId].wins++;
      }
    }
    return Object.values(stats).sort((a, b) => b.wins - a.wins).slice(0, 10);
  })();

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

  const handleSaveEdit = async () => {
    try {
      await apiFetch(`/api/v1/playgroups/${id}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }) });
      setShowEdit(false); load();
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleClaimPlayer = async (playerId: string) => {
    Alert.alert("Claim Player", "Link this player to your account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Claim", onPress: async () => {
        try { await apiFetch(`/api/v1/playgroups/${id}/players/${playerId}/claim`, { method: "POST" }); load(); }
        catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  const handleRemovePlayer = async (playerId: string) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await apiFetch(`/api/v1/playgroups/${id}/players/${playerId}`, { method: "DELETE" }); load(); }
        catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert("Remove Member", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await apiFetch(`/api/v1/playgroups/${id}/members/${memberId}`, { method: "DELETE" }); load(); }
        catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
      }},
    ]);
  };

  const getPlayerName = (p: GameSummary["players"][0]) => p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "Unknown";

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;
  if (!pg) return <View style={styles.center}><Text style={styles.muted}>Playgroup not found</Text></View>;

  return (
    <>
      <Stack.Screen options={{
        title: pg.name,
        headerRight: isAdmin ? () => (
          <Pressable onPress={() => setShowEdit(!showEdit)}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : undefined,
      }} />
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.amber} />}>
        {pg.description && !showEdit && <Text style={styles.desc}>{pg.description}</Text>}

        {/* Edit form */}
        {showEdit && (
          <View style={styles.editForm}>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} value={editDesc} onChangeText={setEditDesc} placeholder="Description" placeholderTextColor={colors.textMuted} />
            <Pressable style={styles.saveButton} onPress={handleSaveEdit}><Text style={styles.saveButtonText}>Save</Text></Pressable>
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {leaderboard.map((entry, i) => (
              <View key={entry.name} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>#{i + 1}</Text>
                <Text style={styles.leaderName}>{entry.name}</Text>
                <Text style={styles.leaderStat}>{entry.wins}W / {entry.games}G</Text>
                <Text style={styles.leaderRate}>{entry.games > 0 ? Math.round((entry.wins / entry.games) * 100) : 0}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Games */}
        {games.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Games ({games.length})</Text>
            {games.slice(0, 10).map((game) => {
              const winner = game.players.find((p) => p.isWinner);
              return (
                <Pressable key={game.id} style={styles.gameRow} onPress={() => router.push(`/(tabs)/games/${game.id}` as never)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameFormat}>{FORMAT_LABELS[game.format as keyof typeof FORMAT_LABELS] ?? game.format}</Text>
                    <Text style={styles.gamePlayers}>{game.players.map(getPlayerName).join(", ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.gameDate}>{new Date(game.playedAt).toLocaleDateString()}</Text>
                    {winner && <Text style={styles.gameWinner}>{getPlayerName(winner)}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({pg.members.length})</Text>
            {isAdmin && <Pressable onPress={() => setShowInvite(!showInvite)}><Text style={styles.addText}>+ Invite</Text></Pressable>}
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
            <Pressable onPress={() => setShowAddPlayer(!showAddPlayer)}><Text style={styles.addText}>+ Add</Text></Pressable>
          </View>
          {showAddPlayer && (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Player name" placeholderTextColor={colors.textMuted} value={newPlayerName} onChangeText={setNewPlayerName} />
              <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor={colors.textMuted} value={newPlayerEmail} onChangeText={setNewPlayerEmail} keyboardType="email-address" autoCapitalize="none" />
              <Pressable style={styles.smallButton} onPress={handleAddPlayer}><Text style={styles.smallButtonText}>Add</Text></Pressable>
            </View>
          )}
          {pg.players.length === 0 && <Text style={styles.muted}>No unlinked players</Text>}
          {pg.players.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{p.name}</Text>
                {p.linkedUser && <Text style={styles.linkedText}>Linked to {p.linkedUser.username}</Text>}
              </View>
              {!p.linkedUser && <Pressable onPress={() => handleClaimPlayer(p.id)}><Text style={styles.claimText}>Claim</Text></Pressable>}
              {isAdmin && <Pressable onPress={() => handleRemovePlayer(p.id)}><Text style={styles.removeText}>Remove</Text></Pressable>}
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  muted: { color: colors.textMuted, fontSize: fontSize.md },
  desc: { color: colors.textSecondary, fontSize: fontSize.md, marginBottom: spacing.lg },
  editForm: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 10, gap: spacing.sm, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  saveButton: { backgroundColor: colors.amber, padding: spacing.sm, borderRadius: 6, alignItems: "center" },
  saveButtonText: { color: colors.background, fontWeight: "bold" },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  addText: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.md },
  // Leaderboard
  leaderRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  leaderRank: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.md, width: 30 },
  leaderName: { flex: 1, color: colors.text, fontSize: fontSize.md },
  leaderStat: { color: colors.textSecondary, fontSize: fontSize.sm },
  leaderRate: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.sm, width: 36, textAlign: "right" },
  // Games
  gameRow: { flexDirection: "row", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  gameFormat: { color: colors.amber, fontSize: fontSize.sm, fontWeight: "600" },
  gamePlayers: { color: colors.textSecondary, fontSize: fontSize.sm },
  gameDate: { color: colors.textMuted, fontSize: fontSize.sm },
  gameWinner: { color: colors.green, fontSize: fontSize.sm, fontWeight: "600" },
  // Forms
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
