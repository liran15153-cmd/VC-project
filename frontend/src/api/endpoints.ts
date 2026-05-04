import { api, request } from './client';
import { requireSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  AuthResponse, Dimension, EditGameResponse, EngineGenerateResponse, GameJSON, GameListResponse,
  Genre, GenerateGameResponse, HealthResponse, MCQGenerateResponse, MeResponse, SavedGame,
  StatsEventsResponse, StatsResponse, TokenBalance,
} from '../types/api';

type GameRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  genre: string | null;
  dimension: Dimension | null;
  difficulty: string | null;
  game_json: GameJSON;
  html_string: string | null;
  thumbnail_url: string | null;
  prompt: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

function mapGame(row: GameRow): SavedGame {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    genre: row.genre || undefined,
    dimension: row.dimension || undefined,
    difficulty: row.difficulty || undefined,
    gameJSON: row.game_json,
    htmlString: row.html_string || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: row.is_published,
  };
}

async function currentUserId(): Promise<string> {
  requireSupabaseConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You are signed out. Please log in again.');
  return data.user.id;
}

function gamePatch(data: Partial<SavedGame> & { gameJSON?: GameJSON; htmlString?: string }) {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.genre !== undefined ? { genre: data.genre } : {}),
    ...(data.dimension !== undefined ? { dimension: data.dimension } : {}),
    ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
    ...(data.gameJSON !== undefined ? { game_json: data.gameJSON } : {}),
    ...(data.htmlString !== undefined ? { html_string: data.htmlString } : {}),
    ...(data.thumbnailUrl !== undefined ? { thumbnail_url: data.thumbnailUrl } : {}),
    ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
    ...(data.isPublished !== undefined ? { is_published: data.isPublished } : {}),
  };
}

export const authApi = {
  register: async (data: { email: string; password: string; displayName?: string }): Promise<AuthResponse> => {
    requireSupabaseConfigured();
    const { data: auth, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.displayName || data.email.split('@')[0] } },
    });
    if (error) throw error;
    if (!auth.user) throw new Error('Registration did not return a user.');
    const tokens = auth.session
      ? await tokensApi.get()
      : { userId: auth.user.id, tokensRemaining: 0, tokensTotal: 0, subscription: 'free' };
    return {
      user: {
        id: auth.user.id,
        email: auth.user.email || data.email,
        displayName: data.displayName || data.email.split('@')[0],
        role: 'user',
        subscriptionTier: tokens.subscription,
        createdAt: auth.user.created_at,
      },
      token: auth.session?.access_token || '',
      tokens,
    };
  },
  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    requireSupabaseConfigured();
    const { data: auth, error } = await supabase.auth.signInWithPassword(data);
    if (error) throw error;
    if (!auth.user || !auth.session) throw new Error('Login did not return a session.');
    const tokens = await tokensApi.get();
    return {
      user: {
        id: auth.user.id,
        email: auth.user.email || data.email,
        displayName: auth.user.user_metadata?.display_name || data.email.split('@')[0],
        role: 'user',
        subscriptionTier: tokens.subscription,
        createdAt: auth.user.created_at,
      },
      token: auth.session.access_token,
      tokens,
    };
  },
  me: async (): Promise<MeResponse> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('You are signed out. Please log in again.');
    const tokens = await tokensApi.get();
    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        displayName: data.user.user_metadata?.display_name || data.user.email?.split('@')[0],
        role: 'user',
        subscriptionTier: tokens.subscription,
        createdAt: data.user.created_at,
      },
      tokens,
    };
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  },
};

export const tokensApi = {
  get: async (): Promise<TokenBalance> => {
    requireSupabaseConfigured();
    const { data, error } = await supabase.rpc('get_token_balance');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return {
      userId: row?.user_id,
      tokensRemaining: row?.tokens_remaining ?? 0,
      tokensTotal: row?.tokens_total ?? 0,
      subscription: row?.subscription ?? 'free',
    };
  },
};

export const healthApi = {
  get: () => api.get<HealthResponse>('/health', { auth: false }),
};

export const mcqApi = {
  generate: (data: { prompt: string; gameType?: Genre; dimension?: Dimension; model?: string }) =>
    api.post<MCQGenerateResponse>('/mcq/generate', data),
};

export const generationApi = {
  generateGame: (data: {
    prompt: string;
    answers?: Record<string, string>;
    gameType: Genre;
    dimension: Dimension;
    model?: string;
    saveToDb?: boolean;
  }) => api.post<GenerateGameResponse>('/generate-game', data),

  editGame: (data: {
    gameId?: string;
    gameJSON?: GameJSON;
    editPrompt: string;
    model?: string;
    saveToDb?: boolean;
  }) => api.post<EditGameResponse>('/edit-game', data),
};

export const engineApi = {
  generate: (data: { prompt: string; model?: string }) =>
    api.post<EngineGenerateResponse>('/engine/generate', data, { auth: false }),
};

export const gamesApi = {
  list: async (params?: { limit?: number; offset?: number; orderBy?: 'updated_at' | 'created_at' | 'title' }): Promise<GameListResponse> => {
    requireSupabaseConfigured();
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const orderBy = params?.orderBy ?? 'updated_at';
    const { data, error, count } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: orderBy === 'title' })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    const total = count ?? data?.length ?? 0;
    return {
      items: ((data || []) as GameRow[]).map(mapGame),
      total,
      pagination: { limit, offset, hasMore: offset + limit < total },
    };
  },
  get: async (id: string): Promise<SavedGame> => {
    requireSupabaseConfigured();
    const { data, error } = await supabase.from('games').select('*').eq('id', id).single();
    if (error) throw error;
    return mapGame(data as GameRow);
  },
  create: async (data: Partial<SavedGame> & { title: string; gameJSON: GameJSON; htmlString?: string }): Promise<SavedGame> => {
    const userId = await currentUserId();
    const payload = {
      user_id: userId,
      title: data.title,
      description: data.description ?? data.gameJSON.metadata.description ?? null,
      genre: data.genre ?? data.gameJSON.metadata.genre ?? null,
      dimension: data.dimension ?? data.gameJSON.metadata.dimension ?? null,
      difficulty: data.difficulty ?? (data.gameJSON.metadata.difficulty ? String(data.gameJSON.metadata.difficulty) : null),
      game_json: data.gameJSON,
      html_string: data.htmlString ?? null,
      thumbnail_url: data.thumbnailUrl ?? null,
      prompt: data.prompt ?? null,
      is_published: data.isPublished ?? false,
    };
    const { data: row, error } = await supabase.from('games').insert(payload).select('*').single();
    if (error) throw error;
    return mapGame(row as GameRow);
  },
  update: async (id: string, patch: Partial<SavedGame>): Promise<SavedGame> => {
    requireSupabaseConfigured();
    const { data, error } = await supabase.from('games').update(gamePatch(patch)).eq('id', id).select('*').single();
    if (error) throw error;
    return mapGame(data as GameRow);
  },
  remove: async (id: string): Promise<{ success: boolean; id: string }> => {
    requireSupabaseConfigured();
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (error) throw error;
    return { success: true, id };
  },
  download: async (id: string): Promise<Blob> => {
    const game = await gamesApi.get(id);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('index.html', game.htmlString || '<!doctype html><title>Game</title><p>No HTML saved.</p>');
    zip.file('game.json', JSON.stringify(game.gameJSON || {}, null, 2));
    zip.file('README.md', `# ${game.title}\n\nGenerated by Gaming Vibe Coding.\nOpen index.html in a browser to play.\n`);
    return zip.generateAsync({ type: 'blob' });
  },
};

export const statsApi = {
  overview: async (): Promise<StatsResponse> => {
    requireSupabaseConfigured();
    const [games, events, failures] = await Promise.all([
      supabase.from('games').select('id', { count: 'exact', head: true }),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).not('error_message', 'is', null),
    ]);
    if (games.error) throw games.error;
    if (events.error) throw events.error;
    if (failures.error) throw failures.error;
    return {
      totalGames: games.count ?? 0,
      totalEvents: events.count ?? 0,
      generationFailures: failures.count ?? 0,
    };
  },
  events: async (limit = 50): Promise<StatsEventsResponse> => {
    requireSupabaseConfigured();
    const { data, error } = await supabase
      .from('analytics_events')
      .select('id,event_type,user_id,game_id,generation_time_ms,error_message,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return {
      events: (data || []).map((row) => ({
        id: row.id,
        eventType: row.event_type,
        userId: row.user_id,
        gameId: row.game_id,
        generationTimeMs: row.generation_time_ms,
        errorMessage: row.error_message,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
    };
  },
};

export const promptHistoryApi = {
  create: async (data: {
    gameId?: string | null;
    prompt: string;
    mcqQuestions?: unknown;
    mcqAnswers?: unknown;
    model?: string;
    durationMs?: number;
    actionType: 'mcq' | 'create' | 'edit';
  }) => {
    const userId = await currentUserId();
    const { error } = await supabase.from('prompt_history').insert({
      user_id: userId,
      game_id: data.gameId ?? null,
      prompt: data.prompt,
      mcq_questions: data.mcqQuestions ?? null,
      mcq_answers: data.mcqAnswers ?? null,
      model: data.model ?? null,
      duration_ms: data.durationMs ?? null,
      action_type: data.actionType,
    });
    if (error) throw error;
  },
};

export const analyticsApi = {
  create: async (data: {
    eventType: string;
    gameId?: string | null;
    generationTimeMs?: number | null;
    errorMessage?: string | null;
    metadata?: unknown;
  }) => {
    const userId = await currentUserId();
    const { error } = await supabase.from('analytics_events').insert({
      user_id: userId,
      game_id: data.gameId ?? null,
      event_type: data.eventType,
      generation_time_ms: data.generationTimeMs ?? null,
      error_message: data.errorMessage ?? null,
      metadata: data.metadata ?? {},
    });
    if (error) throw error;
  },
};

// Re-export raw request for special cases.
export { request };
