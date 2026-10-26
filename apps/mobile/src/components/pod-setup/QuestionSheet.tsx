import { useState } from "react";
import { Modal, View, Text, Pressable, Image, TextInput, StyleSheet, ScrollView } from "react-native";
import type { Pin, PodQuestion } from "@karakas/shared";
import { colors, spacing, fontSize } from "../../constants/theme";

type Props = {
  question: PodQuestion;
  remaining: number;
  onAnswer: (pins: Pin[]) => void;
  onSkipAll: () => void;
};

/** One setup question at a time, as a bottom sheet. */
export function QuestionSheet({ question, remaining, onAnswer, onSkipAll }: Props) {
  const [customName, setCustomName] = useState("");

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onSkipAll}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Quick check{remaining > 1 ? ` · ${remaining} left` : ""}</Text>
            <Pressable onPress={onSkipAll}>
              <Text style={styles.skip}>Use suggestions</Text>
            </Pressable>
          </View>

          {question.imageUrls.length > 0 && (
            <View style={styles.images}>
              {question.imageUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.image} />
              ))}
            </View>
          )}

          <Text style={styles.prompt}>{question.prompt}</Text>

          <ScrollView style={{ maxHeight: 320 }}>
            {question.options.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.option, option.id === question.defaultOptionId && styles.optionDefault]}
                onPress={() => onAnswer(option.pins)}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.detail && <Text style={styles.optionDetail}>{option.detail}</Text>}
              </Pressable>
            ))}
          </ScrollView>

          {question.allowCustomName && (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Type the commander's name"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                disabled={customName.trim().length < 2}
                style={[styles.customButton, customName.trim().length < 2 && { opacity: 0.4 }]}
                onPress={() =>
                  onAnswer([
                    { type: "rename", detectionId: question.allowCustomName!.detectionId, name: customName.trim() },
                  ])
                }
              >
                <Text style={styles.customButtonText}>Use</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  kicker: { fontSize: fontSize.sm, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  skip: { fontSize: fontSize.sm, color: colors.textSecondary },
  images: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  image: { width: 96, height: 64, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  prompt: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.md },
  option: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    marginBottom: spacing.sm,
  },
  optionDefault: { borderColor: colors.amber, backgroundColor: colors.amberDark + "33" },
  optionLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: "500" },
  optionDetail: { fontSize: fontSize.sm, color: colors.textMuted },
  customRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.md,
  },
  customButton: { backgroundColor: colors.amber, borderRadius: 8, paddingHorizontal: spacing.md, justifyContent: "center" },
  customButtonText: { color: colors.background, fontWeight: "bold" },
});
