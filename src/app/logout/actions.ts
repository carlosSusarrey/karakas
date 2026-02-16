"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/session";

export async function logoutUser(): Promise<void> {
  await deleteSession();
  redirect("/");
}
