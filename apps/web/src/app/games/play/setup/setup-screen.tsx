"use client";

import { useIsClient, useSetupDraft } from "@/lib/setup-draft";
import { SetupForm } from "./setup-form";

/** Waits for the client before rendering a rematch, since its draft lives in localStorage. */
export function SetupScreen({
  aiSetup,
  rematch,
  playgroupId,
}: {
  aiSetup: boolean;
  rematch: boolean;
  playgroupId: string | null;
}) {
  const isClient = useIsClient();
  const draft = useSetupDraft();

  if (rematch && !isClient) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">Loading...</div>
    );
  }
  return <SetupForm aiSetup={aiSetup} initialDraft={rematch ? draft : null} initialPlaygroupId={playgroupId} />;
}
