import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NewDeckForm } from "./new-deck-form";

export default async function NewDeckPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <NewDeckForm username={user.username} />;
}
