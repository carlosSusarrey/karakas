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

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Email/username and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login(identifier.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
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
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Email or username"
            placeholderTextColor={colors.textMuted}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

          <Link href="/(auth)/signup" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkHighlight}>Sign up</Text>
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
