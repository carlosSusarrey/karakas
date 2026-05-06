import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function PlaySetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/games/play/setup");
  return <SetupForm />;
}
