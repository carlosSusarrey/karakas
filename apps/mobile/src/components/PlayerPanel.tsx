import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
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

  // Badges (poison, energy, experience, monarch, initiative)
  const badges: { label: string; value: number | string; color: string }[] = [];
  if (player.poisonCounters > 0)
    badges.push({ label: "☠", value: player.poisonCounters, color: "#22c55e" });
  if (player.energyCounters > 0)
    badges.push({ label: "⚡", value: player.energyCounters, color: "#facc15" });
  if (player.experienceCounters > 0)
    badges.push({ label: "★", value: player.experienceCounters, color: "#c084fc" });
  if (player.isMonarch)
    badges.push({ label: "👑", value: "", color: "#fbbf24" });
  if (player.hasInitiative)
    badges.push({ label: "⚔", value: "", color: "#60a5fa" });

  // Commander damage indicators
  const cmdDamage = Object.entries(player.commanderDamage).filter(
    ([, v]) => v > 0
  );

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View
        style={[
          styles.panel,
          { backgroundColor: color },
          isActive && styles.activePanel,
          player.isEliminated && styles.eliminatedPanel,
          rotated && styles.rotated,
        ]}
      >
        {/* Player name */}
        <Text style={[styles.playerName, player.isEliminated && styles.eliminatedText]}>
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
            <Text style={styles.lifeZoneSymbol}>−</Text>
          </Pressable>
        </View>

        {/* Badges row */}
        {badges.length > 0 && (
          <View style={styles.badgeRow}>
            {badges.map((badge, i) => (
              <View key={i} style={styles.badge}>
                <Text style={[styles.badgeText, { color: badge.color }]}>
                  {badge.label}
                  {badge.value !== "" ? ` ${badge.value}` : ""}
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
                <Text style={styles.cmdDamageText}>⚔ {dmg}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Eliminated overlay */}
        {player.isEliminated && (
          <View style={styles.eliminatedOverlay}>
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
    borderRadius: 8,
    margin: 2,
    overflow: "hidden",
    position: "relative",
  },
  activePanel: {
    borderWidth: 2,
    borderColor: colors.amberLight,
  },
  eliminatedPanel: {
    opacity: 0.5,
  },
  rotated: {
    transform: [{ rotate: "180deg" }],
  },
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    position: "absolute",
    top: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    color: "rgba(255,255,255,0.3)",
    fontWeight: "bold",
  },
  lifeTotal: {
    fontWeight: "bold",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  dangerText: {
    color: colors.red,
  },
  eliminatedText: {
    color: "rgba(255,255,255,0.4)",
  },
  badgeRow: {
    flexDirection: "row",
    position: "absolute",
    bottom: spacing.sm,
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
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
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
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
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  eliminatedLabel: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.red,
    letterSpacing: 2,
  },
});
