import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { db } from "./db";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeHexLowerCase(bytes);
}

function hashToken(token: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = sha256(data);
  return encodeHexLowerCase(hash);
}

export async function createPasswordResetToken(
  userId: string
): Promise<string> {
  // Delete any existing tokens for this user
  await db.passwordResetToken.deleteMany({
    where: { userId },
  });

  const token = generateToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await db.passwordResetToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
    },
  });

  // Return the unhashed token (this is what goes in the email)
  return token;
}

export async function validatePasswordResetToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  const hashedToken = hashToken(token);

  const resetToken = await db.passwordResetToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!resetToken) {
    return { valid: false, error: "Invalid or expired reset link" };
  }

  if (resetToken.expiresAt < new Date()) {
    // Clean up expired token
    await db.passwordResetToken.delete({
      where: { id: resetToken.id },
    });
    return { valid: false, error: "Reset link has expired" };
  }

  return { valid: true, userId: resetToken.userId };
}

export async function consumePasswordResetToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  const validation = await validatePasswordResetToken(token);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const hashedToken = hashToken(token);

  // Delete the token after use
  await db.passwordResetToken.delete({
    where: { token: hashedToken },
  });

  return { success: true, userId: validation.userId };
}
