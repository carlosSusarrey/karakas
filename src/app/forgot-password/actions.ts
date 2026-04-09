"use server";

import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";

export async function requestPasswordReset(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  // Find user by email
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  // Don't send reset email for OAuth-only users (no password set)
  if (!user.passwordHash) {
    return { success: true };
  }

  // Create reset token and send email
  const token = await createPasswordResetToken(user.id);
  const emailResult = await sendPasswordResetEmail(user.email, token);

  if (!emailResult.success) {
    console.error("Failed to send password reset email:", emailResult.error);
    return { error: "Failed to send reset email. Please try again later." };
  }

  return { success: true };
}
