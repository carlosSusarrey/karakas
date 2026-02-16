"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export async function login(
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectUrl = (formData.get("redirectUrl") as string) || "/";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await signIn(email, password);

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(redirectUrl);
}
