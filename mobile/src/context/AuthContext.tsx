import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../services/secureStore';
import { User } from '../types';
import { api } from '../services/api';

const USER_KEY = '@vito_user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
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
        let cachedUser = await secureStorage.getItem(USER_KEY);
        if (!cachedUser) {
          const legacyUser = await AsyncStorage.getItem(USER_KEY);
          if (legacyUser) {
            cachedUser = legacyUser;
            await secureStorage.setItem(USER_KEY, legacyUser);
            await AsyncStorage.removeItem(USER_KEY).catch(() => {});
          }
        }
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            setIsInitialLoading(false);
          } catch {}
        }
        if (api.getToken()) {
          const res = await api.getMe();
          if (res?.user) {
            setUser(res.user);
            await secureStorage.setItem(USER_KEY, JSON.stringify(res.user));
          }
        }
      } catch (e: any) {
        // Se foi erro 401 não autorizado, limpa a sessão
        if (e?.message?.includes('401') || e?.message?.includes('não autorizado')) {
          await api.setToken(null);
          await secureStorage.removeItem(USER_KEY);
          await AsyncStorage.removeItem(USER_KEY).catch(() => {});
          setUser(null);
        }
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
      await AsyncStorage.removeItem(USER_KEY).catch(() => {});
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
      await AsyncStorage.removeItem(USER_KEY).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await api.setToken(null);
    await secureStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(USER_KEY).catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isInitialLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
