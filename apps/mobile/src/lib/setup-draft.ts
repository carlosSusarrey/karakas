import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SetupDraft } from "@karakas/shared";

const DRAFT_KEY = "karakas_setup_draft";

export async function loadSetupDraft(): Promise<SetupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SetupDraft;
    return draft.format && Array.isArray(draft.players) ? draft : null;
  } catch {
    return null;
  }
}

export async function saveSetupDraft(draft: SetupDraft) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // the rematch just starts from scratch
  }
}

export async function clearSetupDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
