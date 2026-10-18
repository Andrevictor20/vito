import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../services/secureStore';
import { User } from '../types';
import { api } from '../services/api';
import { googleAuthService } from '../services/googleAuthService';
import { notificationService } from '../services/notificationService';


const USER_KEY = '@vito_user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithWhatsApp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && api.getRefreshToken()) {
        (api as any).ensureFreshToken?.().catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await api.init();
        let token = api.getToken();
        const refreshToken = api.getRefreshToken();

        // Se houver refresh token e o token de acesso estiver ausente ou prestes a expirar, renova proativamente
        if (refreshToken && (!token || (api as any).isTokenExpiringSoon?.())) {
          try {
            token = (await (api as any).ensureFreshToken?.()) || api.getToken();
          } catch (e) {
            console.log('[AuthContext] Falha ao renovar token no bootstrap, prosseguindo com cache:', e);
          }
        }

        const cachedUser = await secureStorage.getItem(USER_KEY);
        if (cachedUser && (token || refreshToken)) {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed && parsed.id) {
              setUser(parsed);
              setIsInitialLoading(false);
            }
          } catch {}
        } else if (cachedUser && !token && !refreshToken) {
          console.warn('[AuthContext] Usuário em cache sem token válido. Limpando sessão inconsistente.');
          await secureStorage.removeItem(USER_KEY);
          setUser(null);
        }

        // Validação ou atualização silenciosa do perfil em background se houver token ou refresh token
        if (api.getToken() || api.getRefreshToken()) {
          try {
            const res = await api.getMe();
            if (res?.user) {
              setUser(res.user);
              await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
              // Auto-upgrade: se o backend devolveu refresh_token que o cliente não tinha (ex: Google OAuth anterior), salva na hora
              if ((res as any).refresh_token && !api.getRefreshToken()) {
                await (api as any).setAuthTokens(
                  (res as any).access_token || api.getToken(),
                  (res as any).refresh_token,
                  (res as any).session_id
                );
              }
            }
          } catch (meErr: any) {
            const errMsg = meErr?.message || '';
            const hasRefreshToken = !!api.getRefreshToken();
            // Apenas desloga se o token for explicitamente rejeitado e NÃO houver refresh token para recuperar
            if (!hasRefreshToken && (errMsg.includes('401') || errMsg.includes('inválido') || errMsg.includes('expirado') || errMsg.includes('revogada') || errMsg.includes('não autorizado') || errMsg.includes('ausente'))) {
              console.warn('[AuthContext] Sessão sem refresh token expirada no servidor, deslogando:', errMsg);
              await api.setAuthTokens(null, null, null);
              await secureStorage.removeItem(USER_KEY);
              setUser(null);
            } else {
              // Erros transitórios de rede/timeout ou refresh pendente: mantém o usuário autenticado com cache local
              console.log('[AuthContext] Mantendo sessão ativa com cache local offline:', errMsg);
            }
          }
        }
      } catch (e: any) {
        console.warn('[AuthContext] Erro no bootstrap de autenticação:', e);
      } finally {
        setIsInitialLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
      await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
      notificationService.syncPushTokenWithBackend().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(name, email, pass);
      setUser(res.user);
      await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
      notificationService.syncPushTokenWithBackend().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const res = await googleAuthService.loginWithGoogle(api.getBaseUrl());
      if (typeof (api as any).setAuthTokens === 'function') {
        await (api as any).setAuthTokens(res.accessToken || res.token, res.refreshToken, res.sessionId);
      } else {
        await api.setToken(res.accessToken || res.token);
      }
      setUser(res.user);
      await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
      notificationService.syncPushTokenWithBackend().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithWhatsApp = async (phone: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await api.verifyWhatsAppOTP(phone, code);
      setUser(res.user);
      await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
      notificationService.syncPushTokenWithBackend().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // 1. Revoga o push token no backend Go para prevenir push leakage para outro usuário no mesmo hardware
      try {
        const pushToken = await notificationService.getSavedPushToken();
        if (pushToken && api.getToken()) {
          await api.revokePushToken(pushToken);
        }
      } catch (tokErr) {
        console.warn('[AuthContext] Falha ao revogar push token no logout:', tokErr);
      }

      // 2. Revoga a sessão de Refresh Token atual no servidor e limpa tokens locais
      await api.logoutSession().catch((err) => {
        console.warn('[AuthContext] Falha ao revogar sessão no logout:', err);
      });

      // 3. Cancela todos os alarmes locais do SO para não tocar alertas da conta anterior
      await notificationService.cancelAllUpcomingReminders().catch(() => {});

      // 4. Remove credenciais e chaves do usuário
      await api.setAuthTokens(null, null, null);
      await secureStorage.removeItem(USER_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <AuthContext.Provider value={{ user, isLoading, isInitialLoading, login, register, loginWithGoogle, loginWithWhatsApp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
