import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PlayerState } from "../reducers/game-reducer";
import { colors, spacing, fontSize } from "../constants/theme";

type Props = {
  player: PlayerState;
  color: string;
  isActive: boolean;
  rotated?: boolean;
  onLifeChange: (amount: number) => void;
  onPress: () => void;
  onLongPress?: () => void;
  compact?: boolean;
  isSwapSource?: boolean;
  isSwapTarget?: boolean;
};

function PlayerPanelInner({
  player,
  color,
  isActive,
  rotated = false,
  onLifeChange,
  onPress,
  onLongPress,
  compact = false,
  isSwapSource = false,
  isSwapTarget = false,
}: Props) {
  const longPressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLifePress = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLifeChange(amount);
    },
    [onLifeChange]
  );

  const startLongPress = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLifeChange(amount * 5);
      longPressTimerRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onLifeChange(amount * 5);
      }, 300);
    },
    [onLifeChange]
  );

  const stopLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearInterval(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const lifeFontSize = compact ? fontSize.life : fontSize.lifeLarge;

  // Counter badges (only poison, energy, experience — monarch/initiative get special treatment)
  const badges: { icon: string; value: number; color: string }[] = [];
  if (player.poisonCounters > 0)
    badges.push({ icon: "skull", value: player.poisonCounters, color: "#22c55e" });
  if (player.energyCounters > 0)
    badges.push({ icon: "flash", value: player.energyCounters, color: "#facc15" });
  if (player.experienceCounters > 0)
    badges.push({ icon: "star", value: player.experienceCounters, color: "#c084fc" });

  // Commander damage indicators
  const cmdDamage = Object.entries(player.commanderDamage).filter(
    ([, v]) => v > 0
  );

  // Golden border for monarch, blue for initiative
  const specialBorder = player.isMonarch
    ? "#fbbf24"
    : player.hasInitiative
      ? "#60a5fa"
      : undefined;

  const iconSize = compact ? 20 : 26;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={500} style={{ flex: 1 }}>
      <View
        style={[
          styles.panel,
          { backgroundColor: color },
          isActive && styles.activePanel,
          specialBorder && { borderWidth: 3, borderColor: specialBorder },
          isSwapSource && styles.swapSourcePanel,
          isSwapTarget && styles.swapTargetPanel,
          player.isEliminated && styles.eliminatedPanel,
          rotated && styles.rotated,
        ]}
      >
        {/* Monarch icon — top left */}
        {player.isMonarch && (
          <View style={styles.monarchIcon}>
            <MaterialCommunityIcons name="crown" size={iconSize} color="#fbbf24" />
          </View>
        )}

        {/* Initiative icon — top right */}
        {player.hasInitiative && (
          <View style={styles.initiativeIcon}>
            <MaterialCommunityIcons name="sword-cross" size={iconSize} color="#60a5fa" />
          </View>
        )}

        {/* Player name */}
        <Text
          style={[
            styles.playerName,
            player.isEliminated && styles.eliminatedText,
          ]}
        >
          {player.name}
        </Text>

        {/* Life total with +/- zones */}
        <View style={styles.lifeContainer}>
          <Pressable
            style={styles.lifeZone}
            onPress={() => handleLifePress(1)}
            onLongPress={() => startLongPress(1)}
            onPressOut={stopLongPress}
          >
            <Text style={styles.lifeZoneSymbol}>+</Text>
          </Pressable>

          <Text
            style={[
              styles.lifeTotal,
              { fontSize: lifeFontSize },
              player.isEliminated && styles.eliminatedText,
              player.lifeTotal <= 0 && styles.dangerText,
            ]}
          >
            {player.lifeTotal}
          </Text>

          <Pressable
            style={styles.lifeZone}
            onPress={() => handleLifePress(-1)}
            onLongPress={() => startLongPress(-1)}
            onPressOut={stopLongPress}
          >
            <Text style={styles.lifeZoneSymbol}>-</Text>
          </Pressable>
        </View>

        {/* Counter badges */}
        {badges.length > 0 && (
          <View style={styles.badgeRow}>
            {badges.map((badge, i) => (
              <View key={i} style={styles.badge}>
                <Ionicons name={badge.icon as keyof typeof Ionicons.glyphMap} size={14} color={badge.color} />
                <Text style={[styles.badgeText, { color: badge.color }]}>
                  {badge.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Commander damage indicators */}
        {cmdDamage.length > 0 && (
          <View style={styles.cmdDamageRow}>
            {cmdDamage.map(([sourceId, dmg]) => (
              <View key={sourceId} style={styles.cmdDamagePill}>
                <Ionicons name="skull-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.cmdDamageText}>{dmg}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Swap source overlay */}
        {isSwapSource && (
          <View style={styles.swapOverlay}>
            <Ionicons name="swap-vertical" size={36} color={colors.amber} />
          </View>
        )}

        {/* Eliminated overlay */}
        {player.isEliminated && !isSwapSource && (
          <View style={styles.eliminatedOverlay}>
            <Ionicons name="close-circle" size={40} color={colors.red} />
            <Text style={styles.eliminatedLabel}>ELIMINATED</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const PlayerPanel = React.memo(PlayerPanelInner);

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    margin: 3,
    overflow: "hidden",
    position: "relative",
  },
  activePanel: {
    borderWidth: 2,
    borderColor: colors.amberLight,
  },
  eliminatedPanel: {
    opacity: 0.4,
  },
  swapSourcePanel: {
    borderWidth: 3,
    borderColor: colors.amber,
    opacity: 0.8,
  },
  swapTargetPanel: {
    borderWidth: 2,
    borderColor: colors.amber + "66",
    borderStyle: "dashed",
  },
  swapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  rotated: {
    transform: [{ rotate: "180deg" }],
  },
  // Monarch / Initiative icons — positioned in opposite corners so they never overlap
  monarchIcon: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(251, 191, 36, 0.3)",
    borderRadius: 14,
    padding: 4,
    zIndex: 10,
  },
  initiativeIcon: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(96, 165, 250, 0.3)",
    borderRadius: 14,
    padding: 4,
    zIndex: 10,
  },
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    position: "absolute",
    top: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  lifeContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
  },
  lifeZone: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  lifeZoneSymbol: {
    fontSize: fontSize["2xl"],
    color: "rgba(255,255,255,0.35)",
    fontWeight: "bold",
  },
  lifeTotal: {
    fontWeight: "bold",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dangerText: {
    color: colors.red,
  },
  eliminatedText: {
    color: "rgba(255,255,255,0.35)",
  },
  badgeRow: {
    flexDirection: "row",
    position: "absolute",
    bottom: spacing.sm,
    gap: spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: "bold",
  },
  cmdDamageRow: {
    flexDirection: "row",
    position: "absolute",
    bottom: spacing.xl + spacing.sm,
    gap: spacing.xs,
  },
  cmdDamagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
  },
  cmdDamageText: {
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "bold",
  },
  eliminatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    gap: spacing.xs,
  },
  eliminatedLabel: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.red,
    letterSpacing: 2,
  },
});
