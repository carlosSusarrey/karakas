import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
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
  const { state, dispatch, canUndo, canRedo, startNewGame } = useGame();
  const { width, height } = useWindowDimensions();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showReorder, setShowReorder] = useState(false);

  const isLandscape = width > height;
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

  const movePlayer = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= state.players.length) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newOrder = [...state.players.map((p) => p.id)];
      [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
      dispatch({ type: "REORDER_PLAYERS", playerIds: newOrder });
    },
    [state.players, dispatch]
  );

  const selectedPlayer = selectedPlayerId
    ? state.players.find((p) => p.id === selectedPlayerId) ?? null
    : null;

  // Layout strategy based on player count and orientation
  const getLayout = () => {
    if (playerCount === 2) {
      return (
        <View style={styles.twoPlayerLayout}>
          <PlayerPanel
            player={state.players[0]}
            color={colors.playerColors[0]}
            isActive={state.activePlayerIndex === 0}
            rotated
            onLifeChange={(amt) => handleLifeChange(state.players[0].id, amt)}
            onPress={() => setSelectedPlayerId(state.players[0].id)}
          />
          <PlayerPanel
            player={state.players[1]}
            color={colors.playerColors[1]}
            isActive={state.activePlayerIndex === 1}
            onLifeChange={(amt) => handleLifeChange(state.players[1].id, amt)}
            onPress={() => setSelectedPlayerId(state.players[1].id)}
          />
        </View>
      );
    }

    if (playerCount <= 4) {
      const rows = [];
      for (let i = 0; i < playerCount; i += 2) {
        const rowPlayers = state.players.slice(i, i + 2);
        rows.push(
          <View key={i} style={styles.gridRow}>
            {rowPlayers.map((player, j) => (
              <PlayerPanel
                key={player.id}
                player={player}
                color={colors.playerColors[i + j]}
                isActive={state.activePlayerIndex === i + j}
                rotated={i === 0}
                compact={playerCount > 2}
                onLifeChange={(amt) => handleLifeChange(player.id, amt)}
                onPress={() => setSelectedPlayerId(player.id)}
              />
            ))}
          </View>
        );
      }
      return <View style={styles.gridLayout}>{rows}</View>;
    }

    const rows = [];
    for (let i = 0; i < playerCount; i += 2) {
      const rowPlayers = state.players.slice(i, Math.min(i + 2, playerCount));
      rows.push(
        <View key={i} style={styles.gridRow}>
          {rowPlayers.map((player, j) => (
            <PlayerPanel
              key={player.id}
              player={player}
              color={colors.playerColors[i + j]}
              isActive={state.activePlayerIndex === i + j}
              rotated={i === 0}
              compact
              onLifeChange={(amt) => handleLifeChange(player.id, amt)}
              onPress={() => setSelectedPlayerId(player.id)}
            />
          ))}
        </View>
      );
    }
    return <View style={styles.gridLayout}>{rows}</View>;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
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

          <Pressable style={styles.controlButton} onPress={() => setShowReorder(true)}>
            <Ionicons name="swap-vertical" size={20} color={colors.text} />
          </Pressable>

          <Pressable style={styles.turnButton} onPress={handleAdvanceTurn}>
            <Text style={styles.turnText}>
              Turn {state.currentTurn}
            </Text>
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

      {/* Reorder modal */}
      <Modal visible={showReorder} animationType="slide" transparent>
        <View style={styles.reorderOverlay}>
          <View style={styles.reorderModal}>
            <View style={styles.reorderHeader}>
              <Text style={styles.reorderTitle}>Reorder Players</Text>
              <Pressable onPress={() => setShowReorder(false)} style={styles.reorderClose}>
                <Ionicons name="checkmark" size={24} color={colors.amber} />
              </Pressable>
            </View>
            <Text style={styles.reorderHint}>Arrange to match seating / turn order</Text>
            <ScrollView style={styles.reorderList}>
              {state.players.map((player, index) => (
                <View key={player.id} style={styles.reorderRow}>
                  <View style={[styles.reorderDot, { backgroundColor: colors.playerColors[index % 6] }]} />
                  <Text style={styles.reorderName}>{player.name}</Text>
                  <View style={styles.reorderButtons}>
                    <Pressable
                      onPress={() => movePlayer(index, -1)}
                      style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
                      disabled={index === 0}
                    >
                      <Ionicons name="chevron-up" size={22} color={index === 0 ? colors.textMuted : colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => movePlayer(index, 1)}
                      style={[styles.reorderBtn, index === state.players.length - 1 && styles.reorderBtnDisabled]}
                      disabled={index === state.players.length - 1}
                    >
                      <Ionicons name="chevron-down" size={22} color={index === state.players.length - 1 ? colors.textMuted : colors.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  playArea: {
    flex: 1,
  },
  twoPlayerLayout: {
    flex: 1,
    flexDirection: "column",
  },
  gridLayout: {
    flex: 1,
    flexDirection: "column",
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
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
  controlButtonDisabled: {
    opacity: 0.3,
  },
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
  // Reorder modal
  reorderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  reorderModal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  reorderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  reorderTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
  },
  reorderClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  reorderList: {},
  reorderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  reorderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  reorderName: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: "600",
  },
  reorderButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  reorderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
});
