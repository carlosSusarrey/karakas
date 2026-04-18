import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useAuth } from "../../../src/contexts/auth-context";
import { apiFetch } from "../../../src/lib/api";
import { colors, spacing, fontSize } from "../../../src/constants/theme";

type Stats = {
  totalGames: number; wins: number; winRate: number;
  formatCounts: Record<string, number>;
  topDecks: { name: string; commander1: string | null; games: number; wins: number; winRate: number }[];
  topCommanders: { name: string; games: number; wins: number; winRate: number }[];
};

type Friend = { friendshipId: string; user: { id: string; username: string; email: string; avatarUrl: string | null }; status: string };
type PendingRequest = { friendshipId: string; user: { id: string; username: string; email: string } };

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, friendsData] = await Promise.all([
        apiFetch<Stats>("/api/v1/stats"),
        apiFetch<{ friends: Friend[]; pendingReceived: PendingRequest[]; pendingSent: PendingRequest[] }>("/api/v1/friends"),
      ]);
      setStats(statsData);
      setFriends(friendsData.friends);
      setPendingReceived(friendsData.pendingReceived);
      setPendingSent(friendsData.pendingSent);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleAddFriend = async () => {
    if (!friendIdentifier.trim()) return;
    try {
      await apiFetch("/api/v1/friends/request", { method: "POST", body: JSON.stringify({ identifier: friendIdentifier.trim() }) });
      Alert.alert("Sent", "Friend request sent!");
      setFriendIdentifier(""); setShowAddFriend(false); load();
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleAccept = async (id: string) => {
    try { await apiFetch(`/api/v1/friends/${id}/accept`, { method: "POST" }); load(); }
    catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleDecline = async (id: string) => {
    try { await apiFetch(`/api/v1/friends/${id}/decline`, { method: "POST" }); load(); }
    catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) return;
    try {
      await apiFetch("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      Alert.alert("Success", "Password changed");
      setCurrentPw(""); setNewPw(""); setShowChangePassword(false);
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed"); }
  };

  if (!isAuthenticated) {
    return (
      <><Stack.Screen options={{ title: "Profile" }} />
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sign in to view your profile</Text>
        <Pressable style={styles.signInButton} onPress={() => router.push("/(auth)/login")}><Text style={styles.signInText}>Sign In</Text></Pressable>
      </View></>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Profile" }} />
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.amber} />}>
        {/* User info */}
        <View style={styles.userCard}>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><Text style={styles.statValue}>{stats.totalGames}</Text><Text style={styles.statLabel}>Games</Text></View>
              <View style={styles.statBox}><Text style={styles.statValue}>{stats.wins}</Text><Text style={styles.statLabel}>Wins</Text></View>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.amber }]}>{stats.winRate}%</Text><Text style={styles.statLabel}>Win Rate</Text></View>
            </View>
            {stats.topDecks.length > 0 && (
              <>
                <Text style={styles.subTitle}>Top Decks</Text>
                {stats.topDecks.map((d, i) => (
                  <View key={i} style={styles.statRow}>
                    <Text style={styles.statRowName}>{d.name}</Text>
                    <Text style={styles.statRowValue}>{d.winRate}% ({d.wins}/{d.games})</Text>
                  </View>
                ))}
              </>
            )}
            {stats.topCommanders.length > 0 && (
              <>
                <Text style={styles.subTitle}>Top Commanders</Text>
                {stats.topCommanders.map((c, i) => (
                  <View key={i} style={styles.statRow}>
                    <Text style={styles.statRowName}>{c.name}</Text>
                    <Text style={styles.statRowValue}>{c.winRate}% ({c.wins}/{c.games})</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Friends */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
            <Pressable onPress={() => setShowAddFriend(!showAddFriend)}><Text style={styles.addText}>+ Add</Text></Pressable>
          </View>
          {showAddFriend && (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Username or email" placeholderTextColor={colors.textMuted} value={friendIdentifier} onChangeText={setFriendIdentifier} autoCapitalize="none" />
              <Pressable style={styles.smallButton} onPress={handleAddFriend}><Text style={styles.smallButtonText}>Send Request</Text></Pressable>
            </View>
          )}
          {pendingReceived.length > 0 && (
            <>
              <Text style={styles.subTitle}>Pending Requests</Text>
              {pendingReceived.map((r) => (
                <View key={r.friendshipId} style={styles.friendRow}>
                  <Text style={styles.friendName}>{r.user.username}</Text>
                  <Pressable onPress={() => handleAccept(r.friendshipId)}><Text style={styles.acceptText}>Accept</Text></Pressable>
                  <Pressable onPress={() => handleDecline(r.friendshipId)}><Text style={styles.declineText}>Decline</Text></Pressable>
                </View>
              ))}
            </>
          )}
          {friends.map((f) => (
            <View key={f.friendshipId} style={styles.friendRow}>
              <Text style={styles.friendName}>{f.user.username}</Text>
            </View>
          ))}
          {friends.length === 0 && pendingReceived.length === 0 && <Text style={styles.emptyText}>No friends yet</Text>}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable style={styles.settingRow} onPress={() => setShowChangePassword(!showChangePassword)}>
            <Text style={styles.settingText}>Change Password</Text>
          </Pressable>
          {showChangePassword && (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={colors.textMuted} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
              <TextInput style={styles.input} placeholder="New password" placeholderTextColor={colors.textMuted} value={newPw} onChangeText={setNewPw} secureTextEntry />
              <Pressable style={styles.smallButton} onPress={handleChangePassword}><Text style={styles.smallButtonText}>Update</Text></Pressable>
            </View>
          )}
          <Pressable style={styles.logoutButton} onPress={() => { logout(); router.replace("/(auth)/login"); }}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md, textAlign: "center" },
  signInButton: { marginTop: spacing.md, backgroundColor: colors.amber, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: 8 },
  signInText: { color: colors.background, fontWeight: "bold", fontSize: fontSize.lg },
  userCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  username: { color: colors.text, fontSize: fontSize["2xl"], fontWeight: "bold" },
  email: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text, marginBottom: spacing.md },
  subTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  addText: { color: colors.amber, fontWeight: "bold", fontSize: fontSize.md },
  statsGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: fontSize["2xl"], fontWeight: "bold" },
  statLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  statRowName: { color: colors.text, fontSize: fontSize.md, flex: 1 },
  statRowValue: { color: colors.textSecondary, fontSize: fontSize.md },
  inlineForm: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, gap: spacing.sm, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceLight, borderRadius: 6, padding: spacing.sm, color: colors.text, fontSize: fontSize.md },
  smallButton: { backgroundColor: colors.amber, padding: spacing.sm, borderRadius: 6, alignItems: "center" },
  smallButtonText: { color: colors.background, fontWeight: "bold" },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  friendName: { flex: 1, color: colors.text, fontSize: fontSize.md },
  acceptText: { color: colors.green, fontWeight: "bold", fontSize: fontSize.sm },
  declineText: { color: colors.red, fontSize: fontSize.sm },
  settingRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingText: { color: colors.text, fontSize: fontSize.md },
  logoutButton: { marginTop: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.red + "22", borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: colors.red },
  logoutText: { color: colors.red, fontWeight: "bold", fontSize: fontSize.md },
});
