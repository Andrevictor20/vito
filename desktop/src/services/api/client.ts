export function getDesktopDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Navegador Web (Desktop)';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Navegador Web (Windows)';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Navegador Web (macOS)';
  if (ua.includes('linux')) return 'Navegador Web (Linux)';
  return 'Navegador Web (Desktop)';
}

export class ApiClient {
  protected baseUrl: string;
  protected accessToken: string | null = null;
  protected refreshToken: string | null = null;
  protected sessionId: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.baseUrl = (import.meta as any).env?.VITE_API_URL || '';
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem('vito_access_token') || sessionStorage.getItem('vito_access_token');
      this.refreshToken = localStorage.getItem('vito_refresh_token') || sessionStorage.getItem('vito_refresh_token');
      this.sessionId = localStorage.getItem('vito_session_id') || sessionStorage.getItem('vito_session_id');
    }
  }

  public setTokens(accessToken: string, refreshToken?: string, sessionId?: string) {
    this.accessToken = accessToken;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vito_access_token', accessToken);
      sessionStorage.setItem('vito_access_token', accessToken);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem('vito_refresh_token', refreshToken);
        sessionStorage.setItem('vito_refresh_token', refreshToken);
      }
      if (sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('vito_session_id', sessionId);
        sessionStorage.setItem('vito_session_id', sessionId);
      }
    }
  }

  public clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.sessionId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vito_access_token');
      sessionStorage.removeItem('vito_access_token');
      localStorage.removeItem('vito_refresh_token');
      sessionStorage.removeItem('vito_refresh_token');
      localStorage.removeItem('vito_session_id');
      sessionStorage.removeItem('vito_session_id');
    }
  }

  public getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return this.refreshToken;
    return this.refreshToken || localStorage.getItem('vito_refresh_token') || sessionStorage.getItem('vito_refresh_token');
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const rf = this.getRefreshToken();
      if (!rf) {
        this.clearTokens();
        return null;
      }
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rf }),
        });
        if (!res.ok) {
          this.clearTokens();
          return null;
        }
        const data = await res.json();
        const newToken = data.access_token || data.token;
        const newRefresh = data.refresh_token || rf;
        this.setTokens(newToken, newRefresh, data.session_id);
        return newToken;
      } catch (e) {
        this.clearTokens();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('X-Device-Name')) {
      headers.set('X-Device-Name', getDesktopDeviceName());
    }
    headers.set('X-Platform', 'web');

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    let response = await fetch(url, { ...options, headers });

    // Se 401, tenta renovar o token e repetir a requisição
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...options, headers });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}
      throw new Error(errorJson?.message || errorJson?.error || `Erro HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  }
}
