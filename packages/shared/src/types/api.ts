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
