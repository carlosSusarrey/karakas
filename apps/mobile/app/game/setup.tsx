import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { MTG_FORMATS, FORMAT_LABELS, getStartingLife } from "@karakas/shared";
import { useGame } from "../../src/contexts/game-context";
import { colors, spacing, fontSize } from "../../src/constants/theme";

const POPULAR_FORMATS = ["commander", "standard", "modern", "draft", "pioneer"] as const;

export default function GameSetupScreen() {
  const router = useRouter();
  const { startNewGame } = useGame();
  const [format, setFormat] = useState("commander");
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [showAllFormats, setShowAllFormats] = useState(false);

  const updatePlayerCount = (count: number) => {
    setPlayerCount(count);
    setPlayerNames((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(`Player ${next.length + 1}`);
      return next.slice(0, count);
    });
  };

  const updatePlayerName = (index: number, name: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  };

  const handleStart = () => {
    const names = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    startNewGame(format, names);
    router.replace("/game/play");
  };

  const startingLife = getStartingLife(format);
  const formatsToShow = showAllFormats ? MTG_FORMATS : POPULAR_FORMATS;

  return (
    <>
      <Stack.Screen options={{ title: "New Game" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Format</Text>
          <View style={styles.formatGrid}>
            {formatsToShow.map((f) => (
              <Pressable
                key={f}
                style={[styles.formatChip, format === f && styles.formatChipActive]}
                onPress={() => setFormat(f)}
              >
                <Text
                  style={[
                    styles.formatChipText,
                    format === f && styles.formatChipTextActive,
                  ]}
                >
                  {FORMAT_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>
          {!showAllFormats && (
            <Pressable onPress={() => setShowAllFormats(true)}>
              <Text style={styles.showMoreText}>Show all formats</Text>
            </Pressable>
          )}
          <Text style={styles.startingLifeText}>
            Starting life: {startingLife}
          </Text>
        </View>

        {/* Player Count */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Players</Text>
          <View style={styles.playerCountRow}>
            {[2, 3, 4, 5, 6].map((count) => (
              <Pressable
                key={count}
                style={[
                  styles.countButton,
                  playerCount === count && styles.countButtonActive,
                ]}
                onPress={() => updatePlayerCount(count)}
              >
                <Text
                  style={[
                    styles.countButtonText,
                    playerCount === count && styles.countButtonTextActive,
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Player Names */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Names</Text>
          {playerNames.map((name, index) => (
            <View key={index} style={styles.nameRow}>
              <View
                style={[
                  styles.playerDot,
                  { backgroundColor: colors.playerColors[index] },
                ]}
              />
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={(text) => updatePlayerName(index, text)}
                placeholder={`Player ${index + 1}`}
                placeholderTextColor={colors.textMuted}
                selectTextOnFocus
              />
            </View>
          ))}
        </View>

        {/* Start Button */}
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  formatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  formatChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formatChipActive: {
    borderColor: colors.amber,
    backgroundColor: colors.amberDark + "33",
  },
  formatChipText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  formatChipTextActive: {
    color: colors.amber,
    fontWeight: "bold",
  },
  showMoreText: {
    color: colors.amber,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  startingLifeText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  playerCountRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  countButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  countButtonActive: {
    borderColor: colors.amber,
    backgroundColor: colors.amberDark + "33",
  },
  countButtonText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
  },
  countButtonTextActive: {
    color: colors.amber,
    fontWeight: "bold",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  playerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  startButton: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.md,
  },
  startButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.background,
  },
});
