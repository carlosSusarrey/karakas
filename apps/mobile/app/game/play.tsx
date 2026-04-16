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
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useGame } from "../../src/contexts/game-context";
import { PlayerPanel } from "../../src/components/PlayerPanel";
import { PlayerDetailModal } from "../../src/components/PlayerDetailModal";
import { colors, spacing, fontSize } from "../../src/constants/theme";

export default function PlayScreen() {
  useKeepAwake();
  const router = useRouter();
  const { state, dispatch, canUndo, canRedo } = useGame();
  const { width, height } = useWindowDimensions();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  const handleNewGame = useCallback(() => {
    Alert.alert("New Game", "Start a new game? Current game will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "New Game",
        style: "destructive",
        onPress: () => router.replace("/game/setup"),
      },
    ]);
  }, [router]);

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

  const selectedPlayer = selectedPlayerId
    ? state.players.find((p) => p.id === selectedPlayerId) ?? null
    : null;

  // Layout strategy based on player count and orientation
  const getLayout = () => {
    if (playerCount === 2) {
      // 2 players: stacked vertically, opponent rotated 180°
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
      // 3-4 players: 2x2 grid (3 players = one empty cell)
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

    // 5-6 players: 3x2 grid
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
        {/* Player panels */}
        <View style={styles.playArea}>{getLayout()}</View>

        {/* Control bar */}
        <View style={styles.controlBar}>
          <Pressable
            style={[styles.controlButton, !canUndo && styles.controlButtonDisabled]}
            onPress={handleUndo}
          >
            <Text style={styles.controlButtonText}>↩</Text>
          </Pressable>

          <Pressable style={styles.controlButton} onPress={handleResetGame}>
            <Text style={styles.controlButtonText}>↻</Text>
          </Pressable>

          <Pressable style={styles.turnButton} onPress={handleAdvanceTurn}>
            <Text style={styles.turnText}>
              Turn {state.currentTurn}
            </Text>
            <Text style={styles.activePlayerText}>
              {state.players[state.activePlayerIndex]?.name}
            </Text>
          </Pressable>

          <Pressable
            style={styles.endGameButton}
            onPress={() => router.push("/game/end")}
          >
            <Text style={styles.endGameButtonText}>End</Text>
          </Pressable>

          <Pressable
            style={[styles.controlButton, !canRedo && styles.controlButtonDisabled]}
            onPress={handleRedo}
          >
            <Text style={styles.controlButtonText}>↪</Text>
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
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  controlButtonText: {
    fontSize: fontSize.xl,
    color: colors.text,
  },
  endGameButton: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.red + "33",
    borderWidth: 1,
    borderColor: colors.red,
    justifyContent: "center",
    alignItems: "center",
  },
  endGameButtonText: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: colors.red,
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
