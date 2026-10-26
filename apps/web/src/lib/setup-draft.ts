import { useSyncExternalStore } from "react";
import type { SetupDraft } from "@karakas/shared";

const DRAFT_KEY = "karakas_setup_draft";

export function loadSetupDraft(): SetupDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SetupDraft;
    return draft.format && Array.isArray(draft.players) ? draft : null;
  } catch {
    return null;
  }
}

export function saveSetupDraft(draft: SetupDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable; the draft just won't survive a reload
  }
}

export function clearSetupDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

let cachedRaw: string | null = null;
let cachedDraft: SetupDraft | null = null;

function draftSnapshot(): SetupDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = loadSetupDraft();
  }
  return cachedDraft;
}

const noopSubscribe = () => () => {};

/** The saved draft on the client; null during server rendering. */
export function useSetupDraft(): SetupDraft | null {
  return useSyncExternalStore(noopSubscribe, draftSnapshot, () => null);
}

/** False during server rendering and hydration, true after. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
