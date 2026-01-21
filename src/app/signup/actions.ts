"use server";

import { signUp } from "@/lib/auth";

export async function signup(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!username || !email || !password) {
    return { error: "All fields are required" };
  }

  if (username.length < 3 || username.length > 20) {
    return { error: "Username must be between 3 and 20 characters" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const result = await signUp(email, username, password);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true };
}
