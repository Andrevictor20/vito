import { ApiClient } from '../../../services/api/client';
import type { AISettings, AutonomyMode } from '../../../types';

export class AiSettingsApi {
  constructor(private client: ApiClient) {}

  async getAISettings(): Promise<AISettings> {
    return this.client.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'GET',
    });
  }

  async updateAISettings(data: {
    autonomy_mode?: AutonomyMode;
    auto_focus_blocks?: boolean;
    persona_style?: string;
    preferred_voice?: string;
  }): Promise<AISettings> {
    return this.client.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
