import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAiEnabled } from "@/lib/feature-flags";
import { SetupScreen } from "./setup-screen";

export const dynamic = "force-dynamic";

export default async function PlaySetupPage({
  searchParams,
}: {
  searchParams: Promise<{ rematch?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/games/play/setup");
  const { rematch } = await searchParams;
  const aiSetup = isAiEnabled(user.username) && !!process.env.ANTHROPIC_API_KEY;
  return <SetupScreen aiSetup={aiSetup} rematch={rematch === "1"} />;
}
