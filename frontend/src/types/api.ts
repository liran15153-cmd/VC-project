// API contract types matching prototype/backend/src/schemas

export type Dimension = '2D' | '3D' | 'hybrid';
export type LegacyDimension = '2D' | '3D';

export const GENRES_2D = ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'] as const;
export const GENRES_3D = ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying'] as const;
export const GENRES_HYBRID = [...GENRES_2D, ...GENRES_3D] as const;
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
    mode?: 'mock' | 'real' | 'hybrid' | string;
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
    mode?: string;
    model?: string;
    durationMs?: number;
    fallback?: boolean;
    fallbackReason?: string;
    schemaRepair?: boolean;
    cached?: boolean;
    tokenOptimized?: boolean;
    tokenOptimization?: unknown;
    tokens?: TokenBalance;
  };
}

export interface GameBrief {
  title: string;
  oneSentencePitch: string;
  playerFantasy: string;
  targetPlatform: 'mobile-first' | 'desktop-first' | 'cross-platform';
  dimension: '2D' | '3D' | 'hybrid';
  genre: string;
  coreLoop: string[];
  keyMechanics: string[];
  controls: {
    primary: string;
    mobile: string;
    accessibilityNotes: string[];
  };
  runtimePlan: {
    runtime: 'hybrid';
    phaserRole: string;
    threeRole: string;
    rapierRole: string;
    godotStyleGenerationNotes: string;
    systems: string[];
  };
  assetPlan: {
    existingAssetsToUse: string[];
    assetsToGenerate: string[];
    visualStyle: string;
  };
  missingInfo: string[];
  followUpQuestions: MCQQuestion[];
  productionNotes: string[];
  nonGoals: string[];
}

export interface GameBriefGenerateResponse {
  brief: GameBrief;
  meta: {
    provider?: string;
    mode?: string;
    model?: string;
    durationMs?: number;
    fallback?: boolean;
    fallbackReason?: string;
    schemaRepair?: boolean;
    cached?: boolean;
    tokenOptimization?: unknown;
    codeGenerated?: false;
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
    dimension: LegacyDimension;
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

export type ResolvedAssetType =
  | 'image' | 'spritesheet' | 'atlas' | 'tilemap' | 'gltf' | 'audio';

export interface ResolvedAsset {
  id: string;
  role: string;
  requirementId?: string;
  name: string;
  type: ResolvedAssetType;
  format?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  engineCompatibility?: string[];
  publicPath: string;
  pack?: string;
  sourcePack?: string;
  sourceRelativePath?: string;
  roleHints?: string[];
  license?: string;
  confidenceScore: number;
  reason: string;
}

export interface CompatibilityWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
}

export interface AssetCoherence {
  totalAssets: number;
  uniquePacks: number;
  gameplayUniquePacks: number;
  dominantPack: string | null;
  dominantGameplayPack: string | null;
  packCounts: Record<string, number>;
  uniqueStyleFamilies: number;
  gameplayUniqueStyleFamilies: number;
  dominantStyle: string | null;
  styleFamilies: string[];
  gameplayStyleFamilies: string[];
  dominantTheme: string | null;
  dimensions: Record<string, number>;
  gameplayDimensions: Record<string, number>;
}

export interface AssetSubstitution {
  requirementId: string;
  role: string;
  requested: string;
  selectedAssetId: string;
  confidenceScore: number;
  reason: string;
}

export interface MissingAsset {
  requirementId: string;
  role: string;
  count: number;
  description: string;
  searchedPacks?: string[];
  attemptedFilters?: string[];
  reason: string;
}

export interface RuntimeAssetManifest {
  engine: string;
  assets: Array<{ key: string; type: string; url: string }>;
}

export interface AssetResolutionMeta {
  agent: string;
  strategy: string;
  targetEngine: string;
  runtimeTarget: string;
  primaryEngine: string;
  assetEngines: string[];
  totalAssets: number;
  candidateAssets: number;
  evaluatedAssets: number;
  intent: string;
  gameType?: string;
  coherence?: AssetCoherence;
  llmReranker?: { enabled: boolean; used: boolean; status: string };
  llmRerankerUsed?: boolean;
  durationMs: number;
}

export interface AssetResolution {
  requirements: Array<{ id: string; role: string; quantity: number; description: string; keywords: string[]; priority: string }>;
  selectedAssets: ResolvedAsset[];
  substitutions: AssetSubstitution[];
  missingAssets: MissingAsset[];
  compatibilityWarnings: CompatibilityWarning[];
  runtimeAssetManifest: RuntimeAssetManifest;
  meta: AssetResolutionMeta;
}

export interface EngineFromBriefResponse {
  brief: GameBrief;
  selectedAssets?: ResolvedAsset[];
  assetResolution?: AssetResolution;
  assetManifest?: RuntimeAssetManifest;
  gameDefinition: unknown;
  meta: {
    provider?: string;
    model?: string;
    durationMs?: number;
    attempts?: number;
    selectedAssetCount?: number;
    compatibilityWarningCount?: number;
    missingAssetCount?: number;
    substitutionCount?: number;
    dominantPack?: string | null;
    gameType?: string | null;
    toolCalling?: unknown;
    normalizationWarningCount?: number;
    persistence?: string;
    tokens?: TokenBalance;
  };
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
