import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useGame } from "../../src/contexts/game-context";
import { PlayerPanel } from "../../src/components/PlayerPanel";
import { PlayerDetailModal } from "../../src/components/PlayerDetailModal";
import { colors, spacing, fontSize } from "../../src/constants/theme";

export default function PlayScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch, canUndo, canRedo } = useGame();
  const { width, height } = useWindowDimensions();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);

  const playerCount = state.players.length;

  const handleLifeChange = useCallback(
    (playerId: string, amount: number) => {
      dispatch({ type: "CHANGE_LIFE", playerId, amount });
    },
    [dispatch]
  );

  const handleAdvanceTurn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dispatch({ type: "ADVANCE_TURN" });
  }, [dispatch]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dispatch({ type: "UNDO" });
    }
  }, [canUndo, dispatch]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dispatch({ type: "REDO" });
    }
  }, [canRedo, dispatch]);

  const handleResetGame = useCallback(() => {
    Alert.alert("Reset Game", "Reset all life totals and counters?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => dispatch({ type: "RESET_GAME" }),
      },
    ]);
  }, [dispatch]);

  const handlePanelPress = useCallback(
    (playerId: string) => {
      if (reorderMode) {
        if (!swapSourceId) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSwapSourceId(playerId);
        } else if (swapSourceId !== playerId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const ids = state.players.map((p) => p.id);
          const fromIdx = ids.indexOf(swapSourceId);
          const toIdx = ids.indexOf(playerId);
          const newOrder = [...ids];
          [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
          dispatch({ type: "REORDER_PLAYERS", playerIds: newOrder });
          setSwapSourceId(null);
        } else {
          setSwapSourceId(null);
        }
      } else {
        setSelectedPlayerId(playerId);
      }
    },
    [reorderMode, swapSourceId, state.players, dispatch]
  );

  const handlePanelLongPress = useCallback(
    (_playerId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setReorderMode(true);
      setSwapSourceId(_playerId);
    },
    []
  );

  const exitReorderMode = useCallback(() => {
    setReorderMode(false);
    setSwapSourceId(null);
  }, []);

  const selectedPlayer = selectedPlayerId
    ? state.players.find((p) => p.id === selectedPlayerId) ?? null
    : null;

  const renderPanel = (player: typeof state.players[0], index: number, rotated: boolean, compact: boolean) => (
    <PlayerPanel
      key={player.id}
      player={player}
      color={colors.playerColors[(player.colorIndex ?? index) % 6]}
      isActive={!reorderMode && state.activePlayerIndex === index}
      rotated={!reorderMode && rotated}
      compact={compact}
      isSwapSource={swapSourceId === player.id}
      isSwapTarget={reorderMode && swapSourceId !== null && swapSourceId !== player.id}
      onLifeChange={(amt) => handleLifeChange(player.id, amt)}
      onPress={() => handlePanelPress(player.id)}
      onLongPress={() => handlePanelLongPress(player.id)}
    />
  );

  const getLayout = () => {
    if (playerCount === 2) {
      return (
        <View style={styles.twoPlayerLayout}>
          {renderPanel(state.players[0], 0, true, false)}
          {renderPanel(state.players[1], 1, false, false)}
        </View>
      );
    }

    const rows = [];
    for (let i = 0; i < playerCount; i += 2) {
      const rowPlayers = state.players.slice(i, Math.min(i + 2, playerCount));
      rows.push(
        <View key={i} style={styles.gridRow}>
          {rowPlayers.map((player, j) =>
            renderPanel(player, i + j, i === 0 && playerCount > 2, playerCount > 2)
          )}
        </View>
      );
    }
    return <View style={styles.gridLayout}>{rows}</View>;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Reorder mode banner */}
        {reorderMode && (
          <View style={styles.reorderBanner}>
            <Ionicons name="swap-vertical" size={16} color={colors.amber} />
            <Text style={styles.reorderBannerText}>
              {swapSourceId ? "Tap another player to swap" : "Tap a player to pick up"}
            </Text>
            <Pressable onPress={exitReorderMode} style={styles.doneBadge}>
              <Ionicons name="checkmark" size={16} color={colors.background} />
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.playArea}>{getLayout()}</View>

        {/* Control bar */}
        <View style={styles.controlBar}>
          <Pressable
            style={[styles.controlButton, !canUndo && styles.controlButtonDisabled]}
            onPress={handleUndo}
          >
            <Ionicons name="arrow-undo" size={20} color={canUndo ? colors.text : colors.textMuted} />
          </Pressable>

          <Pressable style={styles.controlButton} onPress={handleResetGame}>
            <Ionicons name="refresh" size={20} color={colors.text} />
          </Pressable>

          <Pressable
            style={[styles.controlButton, reorderMode && styles.controlButtonActive]}
            onPress={() => {
              if (reorderMode) { exitReorderMode(); }
              else { setReorderMode(true); }
            }}
          >
            <Ionicons name="swap-vertical" size={20} color={reorderMode ? colors.amber : colors.text} />
          </Pressable>

          <Pressable style={styles.turnButton} onPress={handleAdvanceTurn}>
            <Text style={styles.turnText}>Turn {state.currentTurn}</Text>
            <Text style={styles.activePlayerText}>
              {state.players[state.activePlayerIndex]?.name}
              {" "}({state.players.filter((p, i) => !p.isEliminated && i <= state.activePlayerIndex).length}/{state.players.filter((p) => !p.isEliminated).length})
            </Text>
          </Pressable>

          <Pressable
            style={styles.endGameButton}
            onPress={() => router.push("/game/end")}
          >
            <Ionicons name="stop-circle-outline" size={18} color={colors.red} />
          </Pressable>

          <Pressable
            style={[styles.controlButton, !canRedo && styles.controlButtonDisabled]}
            onPress={handleRedo}
          >
            <Ionicons name="arrow-redo" size={20} color={canRedo ? colors.text : colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Player detail modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          visible={!!selectedPlayer}
          player={selectedPlayer}
          allPlayers={state.players}
          format={state.format}
          dispatch={dispatch}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  playArea: { flex: 1 },
  twoPlayerLayout: { flex: 1, flexDirection: "column" },
  gridLayout: { flex: 1, flexDirection: "column" },
  gridRow: { flex: 1, flexDirection: "row" },
  reorderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.amber + "22",
    borderBottomWidth: 1,
    borderBottomColor: colors.amber,
  },
  reorderBannerText: {
    flex: 1,
    color: colors.amber,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  doneText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: "bold",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: colors.amberDark + "33",
    borderWidth: 1,
    borderColor: colors.amber,
  },
  controlButtonDisabled: { opacity: 0.3 },
  endGameButton: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.red + "33",
    borderWidth: 1,
    borderColor: colors.red,
    justifyContent: "center",
    alignItems: "center",
  },
  turnButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  turnText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.amber,
  },
  activePlayerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
