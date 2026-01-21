"use server";

import { updatePassword } from "@/lib/auth";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function resetPassword(
  token: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const result = await consumePasswordResetToken(token);

  if (!result.success || !result.userId) {
    return { error: result.error || "Invalid or expired reset link" };
  }

  await updatePassword(result.userId, password);

  return { success: true };
}
