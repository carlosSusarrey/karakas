import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useGame } from "../src/contexts/game-context";
import { colors, spacing, fontSize } from "../src/constants/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { hasActiveGame } = useGame();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Karakas</Text>
        <Text style={styles.subtitle}>MTG Life Counter</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/game/setup")}
        >
          <Text style={styles.primaryButtonText}>New Game</Text>
        </Pressable>

        {hasActiveGame && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/game/play")}
          >
            <Text style={styles.secondaryButtonText}>Resume Game</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl * 2,
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "bold",
    color: colors.amber,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    width: "100%",
    maxWidth: 300,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.background,
  },
  secondaryButton: {
    borderColor: colors.amber,
    borderWidth: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.amber,
  },
});
