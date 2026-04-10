"use server";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function login(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { error: "Email/username and password are required." };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user || !user.passwordHash) {
    return { error: "Invalid email/username or password." };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { error: "Invalid email/username or password." };
  }

  try {
    await createSession(user.id);
  } catch (err) {
    console.error("Failed to create session:", err);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}
