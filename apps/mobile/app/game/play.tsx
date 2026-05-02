import { useState, useCallback, useRef } from "react";
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useGame } from "../../src/contexts/game-context";
import { PlayerPanel } from "../../src/components/PlayerPanel";
import { PlayerDetailModal } from "../../src/components/PlayerDetailModal";
import { colors, spacing, fontSize } from "../../src/constants/theme";

// Draggable wrapper component so useAnimatedStyle is called at component level
function DraggablePanel({
  player,
  index,
  color,
  isActive,
  rotated,
  compact,
  isDragSource,
  isDropTarget,
  onLifeChange,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMeasure,
}: {
  player: any;
  index: number;
  color: string;
  isActive: boolean;
  rotated: boolean;
  compact: boolean;
  isDragSource: boolean;
  isDropTarget: boolean;
  onLifeChange: (amt: number) => void;
  onPress: () => void;
  onDragStart: () => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: () => void;
  onMeasure: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIdx = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(400)
    .onStart(() => {
      scale.value = withSpring(1.05);
      zIdx.value = 100;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIdx.value = 0;
      runOnJS(onDragEnd)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIdx.value,
    opacity: isDragSource ? 0.85 : 1,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1 }} onLayout={onMeasure}>
          <PlayerPanel
            player={player}
            color={color}
            isActive={isActive}
            rotated={rotated}
            compact={compact}
            isSwapSource={isDragSource}
            isSwapTarget={isDropTarget}
            onLifeChange={onLifeChange}
            onPress={onPress}
            onLongPress={() => {}}
          />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

export default function PlayScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch, canUndo, canRedo } = useGame();
  const { width, height } = useWindowDimensions();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  const panelRects = useRef<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  const panelRefs = useRef<Record<string, View | null>>({});

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

  const measureAllPanels = useCallback(() => {
    const rects: typeof panelRects.current = [];
    state.players.forEach((p) => {
      const ref = panelRefs.current[p.id];
      if (ref) {
        ref.measureInWindow((x, y, w, h) => {
          rects.push({ id: p.id, x, y, w, h });
          if (rects.length === state.players.length) {
            panelRects.current = rects;
          }
        });
      }
    });
  }, [state.players]);

  const findDropTarget = useCallback((absX: number, absY: number) => {
    for (let i = 0; i < panelRects.current.length; i++) {
      const r = panelRects.current[i];
      if (absX >= r.x && absX <= r.x + r.w && absY >= r.y && absY <= r.y + r.h) {
        return i;
      }
    }
    return null;
  }, []);

  const handleDragMove = useCallback((absX: number, absY: number) => {
    const idx = findDropTarget(absX, absY);
    setDropTargetIdx(idx);
  }, [findDropTarget]);

  const handleDragEnd = useCallback((playerId: string) => {
    if (dropTargetIdx !== null) {
      const targetPlayer = state.players[dropTargetIdx];
      if (targetPlayer && targetPlayer.id !== playerId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const ids = state.players.map((p) => p.id);
        const fromIdx = ids.indexOf(playerId);
        const newOrder = [...ids];
        [newOrder[fromIdx], newOrder[dropTargetIdx]] = [newOrder[dropTargetIdx], newOrder[fromIdx]];
        dispatch({ type: "REORDER_PLAYERS", playerIds: newOrder });
      }
    }
    setDraggingId(null);
    setDropTargetIdx(null);
  }, [dropTargetIdx, state.players, dispatch]);

  const selectedPlayer = selectedPlayerId
    ? state.players.find((p) => p.id === selectedPlayerId) ?? null
    : null;

  const renderPanel = (player: typeof state.players[0], index: number, rotated: boolean, compact: boolean) => {
    const isDropTarget = dropTargetIdx !== null && state.players[dropTargetIdx]?.id === player.id && draggingId !== player.id;

    return (
      <DraggablePanel
        key={player.id}
        player={player}
        index={index}
        color={colors.playerColors[(player.colorIndex ?? index) % 6]}
        isActive={state.activePlayerIndex === index}
        rotated={rotated}
        compact={compact}
        isDragSource={draggingId === player.id}
        isDropTarget={isDropTarget}
        onLifeChange={(amt) => handleLifeChange(player.id, amt)}
        onPress={() => {
          if (!draggingId) setSelectedPlayerId(player.id);
        }}
        onDragStart={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setDraggingId(player.id);
        }}
        onDragMove={handleDragMove}
        onDragEnd={() => handleDragEnd(player.id)}
        onMeasure={() => {
          const ref = panelRefs.current[player.id];
          if (ref) {
            ref.measureInWindow((x, y, w, h) => {
              const existing = panelRects.current.findIndex((r) => r.id === player.id);
              if (existing >= 0) {
                panelRects.current[existing] = { id: player.id, x, y, w, h };
              } else {
                panelRects.current.push({ id: player.id, x, y, w, h });
              }
            });
          }
        }}
      />
    );
  };

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
        {draggingId && (
          <View style={styles.dragBanner}>
            <Ionicons name="swap-vertical" size={16} color={colors.amber} />
            <Text style={styles.dragBannerText}>Drop on another player to swap</Text>
          </View>
        )}

        <View style={styles.playArea} onLayout={measureAllPanels}>
          {getLayout()}
        </View>

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
  dragBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.amber + "22",
    borderBottomWidth: 1,
    borderBottomColor: colors.amber,
  },
  dragBannerText: {
    color: colors.amber,
    fontSize: fontSize.sm,
    fontWeight: "600",
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
