"use server";

import { signIn } from "@/lib/auth";

export async function login(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await signIn(email, password);

  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true };
}
