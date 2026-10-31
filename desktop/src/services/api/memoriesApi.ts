import { ApiClient } from './client';

export interface UserMemoryFact {
  id: string;
  user_id: string;
  category: string;
  content: string;
  source: string;
  confidence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryEpisode {
  id: string;
  user_id: string;
  thread_id: string;
  channel: string;
  title: string;
  narrative_summary: string;
  participants_json: string;
  emotional_tone: string;
  importance: number;
  happened_at: string;
}

export interface MemoryThematicSummary {
  id: string;
  user_id: string;
  theme_slug: string;
  theme_title: string;
  consolidated_summary: string;
  fact_count: number;
  episode_count: number;
  last_consolidated_at: string;
}

export interface MemoriesResponse {
  themes: MemoryThematicSummary[];
  episodes: MemoryEpisode[];
  facts: UserMemoryFact[];
}

export class MemoriesApi {
  constructor(private client: ApiClient) {}

  async listMemories(): Promise<MemoriesResponse> {
    return this.client.request<MemoriesResponse>('/api/v1/memories', { method: 'GET' });
  }

  async deleteEpisode(id: string): Promise<void> {
    await this.client.request(`/api/v1/memories/episodes/${id}`, { method: 'DELETE' });
  }

  async deleteThematicSummary(slug: string): Promise<void> {
    await this.client.request(`/api/v1/memories/themes/${slug}`, { method: 'DELETE' });
  }

  async deleteFact(id: string): Promise<void> {
    await this.client.request(`/api/v1/memories/facts/${id}`, { method: 'DELETE' });
  }
}
