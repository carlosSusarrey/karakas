import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PlayerState } from "../reducers/game-reducer";
import { colors, spacing, fontSize } from "../constants/theme";

type Props = {
  player: PlayerState;
  color: string;
  isActive: boolean;
  rotated?: boolean;
  onLifeChange: (amount: number) => void;
  onPress: () => void;
  compact?: boolean;
};

function PlayerPanelInner({
  player,
  color,
  isActive,
  rotated = false,
  onLifeChange,
  onPress,
  compact = false,
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

  // Special border for monarch/initiative
  const monarchBorderColor = player.isMonarch ? "#fbbf24" : undefined;
  const initiativeBorderColor = player.hasInitiative ? "#60a5fa" : undefined;
  const specialBorder = monarchBorderColor ?? initiativeBorderColor;

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={[
          styles.panel,
          { backgroundColor: color },
          isActive && styles.activePanel,
          specialBorder && { borderWidth: 3, borderColor: specialBorder },
          player.isEliminated && styles.eliminatedPanel,
          rotated && styles.rotated,
        ]}
      >
        {/* Monarch crown indicator */}
        {player.isMonarch && (
          <View style={styles.monarchBadge}>
            <Ionicons name="shield" size={compact ? 18 : 22} color="#fbbf24" />
            <Text style={styles.monarchText}>MONARCH</Text>
          </View>
        )}

        {/* Initiative indicator */}
        {player.hasInitiative && (
          <View style={styles.initiativeBadge}>
            <Ionicons name="flash" size={compact ? 18 : 22} color="#60a5fa" />
            <Text style={styles.initiativeText}>INITIATIVE</Text>
          </View>
        )}

        {/* Player name */}
        <Text
          style={[
            styles.playerName,
            player.isEliminated && styles.eliminatedText,
            (player.isMonarch || player.hasInitiative) && { top: compact ? 28 : 32 },
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

        {/* Eliminated overlay */}
        {player.isEliminated && (
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
  rotated: {
    transform: [{ rotate: "180deg" }],
  },
  // Monarch / Initiative indicators
  monarchBadge: {
    position: "absolute",
    top: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251, 191, 36, 0.25)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    zIndex: 10,
  },
  monarchText: {
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  initiativeBadge: {
    position: "absolute",
    top: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(96, 165, 250, 0.25)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    zIndex: 10,
  },
  initiativeText: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
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
