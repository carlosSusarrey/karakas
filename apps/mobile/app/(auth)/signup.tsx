import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Link, Stack } from "expo-router";
import { useAuth } from "../../src/contexts/auth-context";
import { colors, spacing, fontSize } from "../../src/constants/theme";

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signup(username.trim(), email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Karakas</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password (8+ characters)"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkHighlight}>Sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "bold",
    color: colors.amber,
    textAlign: "center",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.red,
    fontSize: fontSize.md,
    textAlign: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.red + "15",
    padding: spacing.sm,
    borderRadius: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.background,
  },
  linkButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  linkText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  linkHighlight: {
    color: colors.amber,
    fontWeight: "bold",
  },
});
