import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { isCommanderFormat } from "@karakas/shared";
import { PlayerState, GameAction } from "../reducers/game-reducer";
import { colors, spacing, fontSize } from "../constants/theme";

type Props = {
  visible: boolean;
  player: PlayerState;
  allPlayers: PlayerState[];
  format: string;
  dispatch: React.Dispatch<GameAction>;
  onClose: () => void;
};

function CounterRow({
  label,
  value,
  onIncrement,
  onDecrement,
  color = colors.text,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: string;
}) {
  return (
    <View style={styles.counterRow}>
      <Text style={[styles.counterLabel, { color }]}>{label}</Text>
      <View style={styles.counterControls}>
        <Pressable
          style={styles.counterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDecrement();
          }}
        >
          <Text style={styles.counterButtonText}>−</Text>
        </Pressable>
        <Text style={[styles.counterValue, { color }]}>{value}</Text>
        <Pressable
          style={styles.counterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onIncrement();
          }}
        >
          <Text style={styles.counterButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PlayerDetailModal({
  visible,
  player,
  allPlayers,
  format,
  dispatch,
  onClose,
}: Props) {
  const opponents = allPlayers.filter((p) => p.id !== player.id);
  const showCommander = isCommanderFormat(format);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{player.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Counters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Counters</Text>
              <CounterRow
                label="☠ Poison"
                value={player.poisonCounters}
                color="#22c55e"
                onIncrement={() =>
                  dispatch({ type: "CHANGE_POISON", playerId: player.id, amount: 1 })
                }
                onDecrement={() =>
                  dispatch({ type: "CHANGE_POISON", playerId: player.id, amount: -1 })
                }
              />
              <CounterRow
                label="⚡ Energy"
                value={player.energyCounters}
                color="#facc15"
                onIncrement={() =>
                  dispatch({ type: "CHANGE_ENERGY", playerId: player.id, amount: 1 })
                }
                onDecrement={() =>
                  dispatch({ type: "CHANGE_ENERGY", playerId: player.id, amount: -1 })
                }
              />
              <CounterRow
                label="★ Experience"
                value={player.experienceCounters}
                color="#c084fc"
                onIncrement={() =>
                  dispatch({ type: "CHANGE_EXPERIENCE", playerId: player.id, amount: 1 })
                }
                onDecrement={() =>
                  dispatch({ type: "CHANGE_EXPERIENCE", playerId: player.id, amount: -1 })
                }
              />
            </View>

            {/* Designations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Designations</Text>
              <View style={styles.designationRow}>
                <Pressable
                  style={[
                    styles.designationButton,
                    player.isMonarch && styles.designationButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (player.isMonarch) {
                      dispatch({ type: "CLEAR_MONARCH" });
                    } else {
                      dispatch({ type: "SET_MONARCH", playerId: player.id });
                    }
                  }}
                >
                  <Text style={styles.designationText}>
                    👑 Monarch {player.isMonarch ? "✓" : ""}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.designationButton,
                    player.hasInitiative && styles.designationButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (player.hasInitiative) {
                      dispatch({ type: "CLEAR_INITIATIVE" });
                    } else {
                      dispatch({ type: "SET_INITIATIVE", playerId: player.id });
                    }
                  }}
                >
                  <Text style={styles.designationText}>
                    ⚔ Initiative {player.hasInitiative ? "✓" : ""}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Commander Damage */}
            {showCommander && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Commander Damage</Text>
                {opponents.map((opp) => {
                  const damage = player.commanderDamage[opp.id] ?? 0;
                  return (
                    <CounterRow
                      key={opp.id}
                      label={`From ${opp.name}`}
                      value={damage}
                      color={colors.red}
                      onIncrement={() =>
                        dispatch({
                          type: "SET_COMMANDER_DAMAGE",
                          playerId: player.id,
                          sourceId: opp.id,
                          amount: damage + 1,
                        })
                      }
                      onDecrement={() =>
                        dispatch({
                          type: "SET_COMMANDER_DAMAGE",
                          playerId: player.id,
                          sourceId: opp.id,
                          amount: Math.max(0, damage - 1),
                        })
                      }
                    />
                  );
                })}
              </View>
            )}

            {/* Elimination */}
            <View style={styles.section}>
              <Pressable
                style={[
                  styles.eliminateButton,
                  player.isEliminated && styles.reinstateButton,
                ]}
                onPress={() => {
                  Haptics.notificationAsync(
                    player.isEliminated
                      ? Haptics.NotificationFeedbackType.Success
                      : Haptics.NotificationFeedbackType.Warning
                  );
                  dispatch({
                    type: player.isEliminated ? "REINSTATE_PLAYER" : "ELIMINATE_PLAYER",
                    playerId: player.id,
                  });
                }}
              >
                <Text style={styles.eliminateButtonText}>
                  {player.isEliminated ? "Reinstate Player" : "Eliminate Player"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  counterLabel: {
    fontSize: fontSize.lg,
    fontWeight: "500",
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonText: {
    fontSize: fontSize.xl,
    color: colors.text,
    fontWeight: "bold",
  },
  counterValue: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    minWidth: 30,
    textAlign: "center",
  },
  designationRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  designationButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
  },
  designationButtonActive: {
    backgroundColor: colors.amberDark + "44",
    borderWidth: 1,
    borderColor: colors.amber,
  },
  designationText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: "600",
  },
  eliminateButton: {
    backgroundColor: colors.red + "33",
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  reinstateButton: {
    backgroundColor: colors.green + "33",
    borderColor: colors.green,
  },
  eliminateButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
  },
});
