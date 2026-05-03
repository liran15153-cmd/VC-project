import { api, getApiBase, getToken, request } from './client';
import type {
  AuthResponse, Dimension, EditGameResponse, EngineGenerateResponse, GameJSON, GameListResponse,
  Genre, GenerateGameResponse, HealthResponse, MCQGenerateResponse, MeResponse, SavedGame,
  StatsEventsResponse, StatsResponse, TokenBalance,
} from '../types/api';

export const authApi = {
  register: (data: { email: string; password: string; displayName?: string }) =>
    api.post<AuthResponse>('/auth/register', data, { auth: false }),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data, { auth: false }),
  me: () => api.get<MeResponse>('/auth/me'),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
};

export const tokensApi = {
  get: () => api.get<TokenBalance>('/user/tokens'),
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
  list: (params?: { limit?: number; offset?: number; orderBy?: 'updated_at' | 'created_at' | 'title' }) =>
    api.get<GameListResponse>('/games', { query: params }),
  get: (id: string) => api.get<SavedGame>(`/games/${id}`),
  create: (data: Partial<SavedGame> & { title: string; gameJSON: GameJSON; htmlString?: string }) =>
    api.post<SavedGame>('/games', data),
  update: (id: string, patch: Partial<SavedGame>) => api.put<SavedGame>(`/games/${id}`, patch),
  remove: (id: string) => api.delete<{ success: boolean; id: string }>(`/games/${id}`),
  download: async (id: string): Promise<Blob> => {
    const base = getApiBase();
    const token = getToken();
    const res = await fetch(`${base}/games/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Download failed (${res.status})`);
    }
    return res.blob();
  },
};

export const statsApi = {
  overview: () => api.get<StatsResponse>('/stats'),
  events: (limit = 50) => api.get<StatsEventsResponse>('/stats/events', { query: { limit } }),
};

// Re-export raw request for special cases.
export { request };
