import React, { createContext, useContext, useState, useEffect } from 'react';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await api.init();
        const cachedUser = await secureStorage.getItem(USER_KEY);
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            if (parsed && parsed.id) {
              setUser(parsed);
              setIsInitialLoading(false);
            }
          } catch {}
        }

        // Validação ou atualização silenciosa do perfil em background se houver token
        if (api.getToken()) {
          try {
            const res = await api.getMe();
            if (res?.user) {
              setUser(res.user);
              await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
            }
          } catch (meErr: any) {
            const errMsg = meErr?.message || '';
            // Apenas desloga se o token for explicitamente rejeitado pelo servidor (401 com token inválido/expirado)
            if (errMsg.includes('401') && (errMsg.includes('inválido') || errMsg.includes('expirado') || errMsg.includes('não autorizado'))) {
              console.warn('[AuthContext] Sessão expirada no servidor, deslogando:', errMsg);
              await api.setToken(null);
              await secureStorage.removeItem(USER_KEY);
              setUser(null);
            } else {
              // Erros transitórios de rede/timeout: mantém o usuário autenticado com cache local
              console.log('[AuthContext] Falha transitória de rede ao validar sessão, mantendo offline/cache:', errMsg);
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
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const { token, user: googleUser } = await googleAuthService.loginWithGoogle(api.getBaseUrl());
      await api.setToken(token);
      setUser(googleUser);
      await secureStorage.setItem(USER_KEY, JSON.stringify(googleUser));
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

      // 2. Cancela todos os alarmes locais do SO para não tocar alertas da conta anterior
      await notificationService.cancelAllUpcomingReminders().catch(() => {});

      // 3. Remove credenciais e chaves do usuário
      await api.setToken(null);
      await secureStorage.removeItem(USER_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <AuthContext.Provider value={{ user, isLoading, isInitialLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
