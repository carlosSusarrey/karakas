"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function signup(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!username || !email || !password) {
    return { error: "All fields are required." };
  }

  if (username.length < 3 || username.length > 20) {
    return { error: "Username must be between 3 and 20 characters." };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Check for existing email
  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { error: "Email already in use." };
  }

  // Check for existing username
  const existingUsername = await db.user.findUnique({ where: { username } });
  if (existingUsername) {
    return { error: "Username already taken." };
  }

  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: {
      email,
      username,
      passwordHash,
    },
  });

  return { success: true };
}
