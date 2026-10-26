// Types for photo-based game setup: commander detection + deck matching.
import type { Confidence } from "./ai-events";
import type { DeckKind } from "./api";

/** Who a player or deck owner is. A guest has neither id. */
export type PlayerIdentity = {
  userId?: string;
  playgroupPlayerId?: string;
};

export type SetupPlayer = PlayerIdentity & {
  /** Stable key for this seat in the setup UI */
  key: string;
  name: string;
};

export type DeckRef = { kind: DeckKind; id: string };

export type CandidateDeck = {
  ref: DeckRef;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  owner: PlayerIdentity & { name: string };
  /** Who played this deck in recent games, newest first */
  pilots: PlayerIdentity[];
};

export type DetectedCommander = {
  id: string;
  /** What the model read off the card */
  rawName: string;
  /** Canonical card name, or null when it couldn't be identified */
  name: string | null;
  /** Detection id of a partner/background printed alongside this one */
  partnerOf?: string;
  confidence: Confidence;
  /** Card center in the photo, 0..1 */
  position: { x: number; y: number };
  /** Alternative names to offer when the read is uncertain */
  suggestions: string[];
  imageUrl?: string;
};

export type PodGroup = {
  /** Detection ids joined with "+" — stable across re-runs */
  id: string;
  detectionIds: string[];
  /** Canonical names; empty when unrecognized */
  commanders: string[];
  imageUrls: string[];
  confidence: Confidence;
};

export type SeatStatus = "owned" | "borrowed" | "new_deck" | "no_deck" | "unmatched";

export type SeatProposal = {
  playerKey: string;
  groupId: string | null;
  commanders: string[];
  imageUrls: string[];
  deck: DeckRef | null;
  deckName: string | null;
  /** Set when the deck belongs to someone else */
  deckOwnerName: string | null;
  bracket: number | null;
  pendingNewDeck: { name: string; commander1: string; commander2?: string } | null;
  status: SeatStatus;
};

/** A user answer, applied as a hard constraint when re-running the matcher. */
export type Pin =
  | { type: "rename"; detectionId: string; name: string }
  | { type: "ignore"; groupId: string }
  | { type: "assign"; groupId: string; playerKey: string; deck?: DeckRef | "new" | "none" }
  | { type: "playerDeck"; playerKey: string; deck: DeckRef | "none" };

export type QuestionType =
  | "confirm_commander"
  | "which_player"
  | "borrowed_confirm"
  | "duplicate_deck"
  | "new_deck"
  | "unmatched_player";

export type QuestionOption = {
  id: string;
  label: string;
  detail?: string;
  pins: Pin[];
};

export type PodQuestion = {
  id: string;
  type: QuestionType;
  groupId: string | null;
  playerKey: string | null;
  prompt: string;
  options: QuestionOption[];
  defaultOptionId: string | null;
  imageUrls: string[];
  /** The UI may offer a card search; the answer becomes a rename pin */
  allowCustomName?: { detectionId: string };
};

export type MatchInput = {
  detections: DetectedCommander[];
  players: SetupPlayer[];
  candidates: CandidateDeck[];
  format: string;
  pins?: Pin[];
  /** Decks each player used last game (rematch hint) */
  previous?: { playerKey: string; deck: DeckRef }[];
};

export type MatchResult = {
  groups: PodGroup[];
  seats: SeatProposal[];
  questions: PodQuestion[];
};
