import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { api } from '../services/api';

const USER_KEY = '@vito_user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await api.init();
        const cachedUser = await AsyncStorage.getItem(USER_KEY);
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            setIsLoading(false);
          } catch {}
        }
        if (api.getToken()) {
          const res = await api.getMe();
          if (res?.user) {
            setUser(res.user);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
          }
        }
      } catch (e: any) {
        // Se foi erro 401 não autorizado, limpa a sessão
        if (e?.message?.includes('401') || e?.message?.includes('não autorizado')) {
          await api.setToken(null);
          await AsyncStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(name, email, pass);
      setUser(res.user);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await api.setToken(null);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
