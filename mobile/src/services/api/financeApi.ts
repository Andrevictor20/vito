import { ApiClient } from './client';
import {
  FinancialSummary,
  FinanceAccount,
  FinanceConnection,
  FinanceConnectionStatusUpdate,
  FinanceTransaction,
  FinanceSyncPayload,
  FinanceConnectTokenResponse,
  FinanceLimitRule,
  FinanceLimitStatus,
  FinanceLimitSuggestion,
  FinanceTransactionFilter,
  SpendingLimitScope,
} from '../../types/finance';

export interface ByokBackupPayload {
  ciphertext: string;
  nonce: string;
  key_version: number;
}

export interface ByokBackupRecord extends ByokBackupPayload {
  updated_at?: string;
}

export class FinanceApi {
  constructor(private client: ApiClient) {}

  /**
   * Obtém o resumo consolidado de finanças (Safe-to-Spend, saldos, faturas e alertas).
   */
  async getSummary(): Promise<FinancialSummary> {
    return this.client.request<FinancialSummary>('/api/v1/finance/summary');
  }

  /**
   * Lista as contas e cartões bancários sincronizados.
   */
  async getAccounts(): Promise<FinanceAccount[]> {
    const res = await this.client.request<FinanceAccount[]>('/api/v1/finance/accounts');
    return Array.isArray(res) ? res : [];
  }

  /**
   * Lista as transações financeiras sincronizadas (extrato e compras de cartão).
   */
  async getTransactions(limit = 50, offset = 0): Promise<FinanceTransaction[]> {
    const res = await this.client.request<FinanceTransaction[]>(`/api/v1/finance/transactions?limit=${limit}&offset=${offset}`);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Lista as conexões ativas com instituições financeiras (Open Finance).
   */
  async getConnections(): Promise<FinanceConnection[]> {
    const res = await this.client.request<FinanceConnection[]>('/api/v1/finance/connections');
    return Array.isArray(res) ? res : [];
  }

  /**
   * Registra uma nova conexão bancária após autorização no widget Meu Pluggy.
   */
  async createConnection(data: { pluggy_item_id: string; connector_id?: number; institution_name?: string }): Promise<FinanceConnection> {
    return this.client.request<FinanceConnection>('/api/v1/finance/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Atualiza status operacional e telemetria de uma conexão bancária (SyncEngine v2).
   */
  async updateConnectionStatus(connectionId: string, data: FinanceConnectionStatusUpdate): Promise<void> {
    await this.client.request<void>(`/api/v1/finance/connections/${connectionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Exclui uma conexão bancária e desassocia contas no backend.
   */
  async deleteConnection(connectionId: string): Promise<void> {
    await this.client.request<void>(`/api/v1/finance/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Obtém token efêmero para abertura do widget de conexão oficial Meu Pluggy.
   */
  async getConnectToken(): Promise<FinanceConnectTokenResponse> {
    return this.client.request<FinanceConnectTokenResponse>('/api/v1/finance/connect-token', {
      method: 'POST',
    });
  }

  /**
   * Endpoint de validação/teste para emissão de connectToken no ambiente de desenvolvimento/MVP.
   */
  async getTestToken(): Promise<FinanceConnectTokenResponse> {
    return this.client.request<FinanceConnectTokenResponse>('/api/v1/finance/test-token');
  }

  /**
   * Edge-Sync: Envia payload consolidado de contas e transações coletadas no dispositivo.
   */
  async sync(payload: FinanceSyncPayload): Promise<{ processed_accounts: number; processed_transactions: number }> {
    return this.client.request<{ processed_accounts: number; processed_transactions: number }>('/api/v1/finance/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Salva blob cifrado no cliente com as chaves BYOK do usuário (`PUT /finance/byok-backup`).
   */
  async saveByokBackup(payload: ByokBackupPayload): Promise<{ status?: string; updated_at?: string }> {
    return this.client.request<{ status?: string; updated_at?: string }>('/api/v1/finance/byok-backup', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Recupera o blob cifrado das chaves BYOK (`GET /finance/byok-backup`). Retorna null se inexistente.
   */
  async getByokBackup(): Promise<ByokBackupRecord | null> {
    try {
      return await this.client.request<ByokBackupRecord>('/api/v1/finance/byok-backup');
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 404) return null;
      throw err;
    }
  }

  /**
   * Remove o backup cifrado das chaves BYOK no servidor (`DELETE /finance/byok-backup`).
   */
  async deleteByokBackup(): Promise<void> {
    await this.client.request<void>('/api/v1/finance/byok-backup', {
      method: 'DELETE',
    });
  }

  // --- Onda 1: Limites Multi-Escopo, Extrato Analítico e Recategorização ---

  async getLimits(scope?: SpendingLimitScope): Promise<FinanceLimitStatus[]> {
    const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    const res = await this.client.request<FinanceLimitStatus[]>(`/api/v1/finance/limits${q}`);
    return Array.isArray(res) ? res : [];
  }

  async createLimit(rule: FinanceLimitRule): Promise<FinanceLimitStatus> {
    return this.client.request<FinanceLimitStatus>('/api/v1/finance/limits', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateLimit(id: string, rule: FinanceLimitRule): Promise<FinanceLimitStatus> {
    return this.client.request<FinanceLimitStatus>(`/api/v1/finance/limits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  async deleteLimit(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/finance/limits/${id}`, { method: 'DELETE' });
  }

  async muteLimit(id: string): Promise<FinanceLimitStatus> {
    return this.client.request<FinanceLimitStatus>(`/api/v1/finance/limits/${id}/mute`, { method: 'POST' });
  }

  async getLimitSuggestions(): Promise<FinanceLimitSuggestion[]> {
    const res = await this.client.request<FinanceLimitSuggestion[]>('/api/v1/finance/limits/suggestions');
    return Array.isArray(res) ? res : [];
  }

  async searchTransactions(filter: FinanceTransactionFilter = {}): Promise<FinanceTransaction[]> {
    const params = new URLSearchParams();
    if (filter.q) params.set('q', filter.q);
    if (filter.account_id) params.set('account_id', filter.account_id);
    if (filter.category) params.set('category', filter.category);
    if (filter.type) params.set('type', filter.type);
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    params.set('limit', String(filter.limit ?? 50));
    params.set('offset', String(filter.offset ?? 0));
    const res = await this.client.request<FinanceTransaction[]>(`/api/v1/finance/transactions?${params.toString()}`);
    return Array.isArray(res) ? res : [];
  }

  async recategorizeTransaction(
    txId: string,
    category: string,
    applyToMerchant = false,
  ): Promise<{ updated_count: number; category: string }> {
    return this.client.request<{ updated_count: number; category: string }>(`/api/v1/finance/transactions/${txId}`, {
      method: 'PATCH',
      body: JSON.stringify({ category, apply_to_merchant: applyToMerchant }),
    });
  }
}
