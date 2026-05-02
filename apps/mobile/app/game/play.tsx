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

export default function PlayScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch, canUndo, canRedo } = useGame();
  const { width, height } = useWindowDimensions();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  // Store panel positions for hit-testing
  const panelPositions = useRef<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  const playAreaRef = useRef<View>(null);

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

  // Drag callbacks
  const onDragStart = useCallback((playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDraggingId(playerId);
  }, []);

  const onDragMove = useCallback((absX: number, absY: number) => {
    // Find which panel the finger is over
    const positions = panelPositions.current;
    let found = -1;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (absX >= p.x && absX <= p.x + p.w && absY >= p.y && absY <= p.y + p.h) {
        found = i;
        break;
      }
    }
    setDropTargetIdx(found >= 0 ? found : null);
  }, []);

  const onDragEnd = useCallback((playerId: string) => {
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

  // Measure panel positions after layout
  const measurePanels = useCallback(() => {
    if (!playAreaRef.current) return;
    playAreaRef.current.measureInWindow((areaX, areaY) => {
      // Calculate positions based on grid layout
      const safeTop = insets.top;
      const controlBarHeight = 56;
      const availableHeight = height - safeTop - controlBarHeight - insets.bottom;
      const availableWidth = width;

      const positions: typeof panelPositions.current = [];

      if (playerCount === 2) {
        const panelH = availableHeight / 2;
        state.players.forEach((p, i) => {
          positions.push({
            id: p.id,
            x: 0,
            y: safeTop + i * panelH,
            w: availableWidth,
            h: panelH,
          });
        });
      } else {
        const cols = 2;
        const rows = Math.ceil(playerCount / cols);
        const panelW = availableWidth / cols;
        const panelH = availableHeight / rows;
        state.players.forEach((p, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          positions.push({
            id: p.id,
            x: col * panelW,
            y: safeTop + row * panelH,
            w: panelW,
            h: panelH,
          });
        });
      }
      panelPositions.current = positions;
    });
  }, [state.players, playerCount, width, height, insets]);

  const renderPanel = (player: typeof state.players[0], index: number, rotated: boolean, compact: boolean) => {
    const isDragSource = draggingId === player.id;
    const isDropTarget = dropTargetIdx !== null && state.players[dropTargetIdx]?.id === player.id && draggingId !== player.id;

    const panelContent = (
      <PlayerPanel
        key={player.id}
        player={player}
        color={colors.playerColors[(player.colorIndex ?? index) % 6]}
        isActive={state.activePlayerIndex === index}
        rotated={rotated}
        compact={compact}
        isSwapSource={isDragSource}
        isSwapTarget={isDropTarget}
        onLifeChange={(amt) => handleLifeChange(player.id, amt)}
        onPress={() => {
          if (!draggingId) setSelectedPlayerId(player.id);
        }}
        onLongPress={() => {}}
      />
    );

    // Wrap each panel in a gesture detector for drag
    const gesture = Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => {
        isDragging.value = true;
        dragX.value = 0;
        dragY.value = 0;
        dragScale.value = withSpring(1.05);
        runOnJS(onDragStart)(player.id);
      })
      .onUpdate((e) => {
        dragX.value = e.translationX;
        dragY.value = e.translationY;
        runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
      })
      .onEnd(() => {
        isDragging.value = false;
        dragX.value = withSpring(0);
        dragY.value = withSpring(0);
        dragScale.value = withSpring(1);
        runOnJS(onDragEnd)(player.id);
      });

    const animatedStyle = useAnimatedStyle(() => {
      if (draggingId !== player.id) return {};
      return {
        transform: [
          { translateX: dragX.value },
          { translateY: dragY.value },
          { scale: dragScale.value },
        ],
        zIndex: 100,
        elevation: 10,
        opacity: 0.9,
      };
    });

    return (
      <Animated.View key={player.id} style={[{ flex: 1 }, animatedStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={{ flex: 1 }} onLayout={() => measurePanels()}>
            {panelContent}
          </View>
        </GestureDetector>
      </Animated.View>
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

    if (playerCount <= 4) {
      const rows = [];
      for (let i = 0; i < playerCount; i += 2) {
        const rowPlayers = state.players.slice(i, i + 2);
        rows.push(
          <View key={i} style={styles.gridRow}>
            {rowPlayers.map((player, j) =>
              renderPanel(player, i + j, i === 0, true)
            )}
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
          {rowPlayers.map((player, j) =>
            renderPanel(player, i + j, i === 0, true)
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
        {/* Drag hint banner */}
        {draggingId && (
          <View style={styles.dragBanner}>
            <Ionicons name="swap-vertical" size={16} color={colors.amber} />
            <Text style={styles.dragBannerText}>Drop on another player to swap</Text>
          </View>
        )}

        <View ref={playAreaRef} style={styles.playArea} onLayout={() => measurePanels()}>
          {getLayout()}
        </View>

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
