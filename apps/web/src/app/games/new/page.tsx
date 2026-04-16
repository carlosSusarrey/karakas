import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NewGameForm } from "./new-game-form";

export default async function NewGamePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <NewGameForm username={user.username} />;
}
