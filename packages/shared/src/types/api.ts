// API request/response types shared between web and mobile

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface PlaygroupSummary {
  id: string;
  name: string;
  description: string | null;
  defaultFormat: string | null;
  role: string;
  memberCount: number;
  playerCount: number;
  gameCount: number;
}

export interface DeckSummary {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  decklistUrl: string | null;
  isActive: boolean;
}

export interface ApiError {
  error: string;
}

export interface AuthFeatures {
  aiSetup: boolean;
}

export type DeckKind = "deck" | "playgroupPlayerDeck";

export interface CompleteGameSeat {
  seat: number;
  userId?: string;
  playgroupPlayerId?: string;
  guestName?: string;
  deck?: { kind: DeckKind; id: string };
  pendingNewDeck?: {
    name: string;
    commander1: string;
    commander2?: string;
    bracket?: number;
  };
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
  eliminatedTurn?: number | null;
}

export interface CompleteGamePowerPlay {
  seat: number;
  turn: number;
  type: string;
  description: string;
  cardName?: string;
}

export interface CompleteGameRequest {
  format: string;
  playgroupId: string | null;
  totalTurns: number | null;
  playedAt?: string;
  isDraw: boolean;
  winnerSeat: number | null;
  seats: CompleteGameSeat[];
  powerPlays?: CompleteGamePowerPlay[];
}

export interface CompleteGameResponse {
  game: { id: string; players: { id: string; seat: number }[] };
  createdDecks: { seat: number; deck: { kind: DeckKind; id: string } }[];
}
