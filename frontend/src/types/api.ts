// API contract types matching prototype/backend/src/schemas

export type Dimension = '2D' | '3D';

export const GENRES_2D = ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'] as const;
export const GENRES_3D = ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'] as const;
export type Genre2D = (typeof GENRES_2D)[number];
export type Genre3D = (typeof GENRES_3D)[number];
export type Genre = Genre2D | Genre3D;

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role?: 'user' | 'admin';
  subscriptionTier?: string;
  createdAt?: string;
}

export interface TokenBalance {
  userId?: string;
  tokensRemaining: number;
  tokensTotal: number;
  subscription?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  tokens: TokenBalance;
}

export interface MeResponse {
  user: User;
  tokens: TokenBalance;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | string;
  version?: string;
  env?: string;
  uptime?: number;
  timestamp?: string;
  services?: {
    database?: 'ok' | 'down' | string;
    ai?: 'configured' | 'not_configured' | string;
    openai?: 'configured' | 'not_configured' | string;
    openrouter?: 'configured' | 'not_configured' | string;
  };
  ai?: {
    provider?: 'openai' | 'openrouter' | string;
    providerLabel?: string;
    configured?: boolean;
    defaultModel?: string;
    supportedModels?: string[];
  };
}

export interface MCQOption { id: string; label: string; value: string; }
export interface MCQQuestion { id: string; question: string; options: MCQOption[]; }

export interface MCQGenerateResponse {
  questions: MCQQuestion[];
  meta: {
    provider?: string;
    model?: string;
    durationMs?: number;
    fallback?: boolean;
    fallbackReason?: string;
    tokens?: TokenBalance;
  };
}

export interface GenerateGameResponse {
  gameId: string | null;
  gameJSON: GameJSON;
  htmlString: string;
  assetManifest?: unknown[];
  meta: {
    provider?: string;
    model?: string;
    durationMs?: number;
    attempts?: number;
    fallback?: boolean;
    fallbackReason?: string;
    savedGameId?: string;
    tokens?: TokenBalance;
  };
}

export interface EditGameResponse extends GenerateGameResponse {}

export interface GameJSON {
  metadata: {
    gameTitle: string;
    description?: string;
    genre: string;
    dimension: Dimension;
    difficulty?: 'easy' | 'medium' | 'hard';
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface SavedGame {
  id: string;
  userId: string;
  title: string;
  description?: string;
  genre?: string;
  dimension?: Dimension;
  difficulty?: string;
  gameJSON?: GameJSON;
  htmlString?: string;
  thumbnailUrl?: string;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
  isPublished?: boolean;
}

export interface GameListResponse {
  items: SavedGame[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}

export interface EngineGenerateResponse {
  gameDefinition: unknown;
  meta: { provider?: string; model?: string; durationMs?: number; attempts?: number };
}

export interface StatsResponse {
  [k: string]: unknown;
}

export interface StatsEvent {
  id?: string | number;
  eventType: string;
  userId?: string | null;
  gameId?: string | null;
  generationTimeMs?: number | null;
  errorMessage?: string | null;
  metadata?: unknown;
  createdAt?: string;
}

export interface StatsEventsResponse {
  events: StatsEvent[];
}
