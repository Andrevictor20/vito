import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  loginWithWhatsApp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      // 1. Intercepta retorno do Google OAuth via query params (?status=success&access_token=...&refresh_token=...)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthStatus = urlParams.get('status');
        const oauthToken = urlParams.get('access_token') || urlParams.get('token');
        const oauthRefreshToken = urlParams.get('refresh_token');
        const oauthUserRaw = urlParams.get('user');

        if (oauthStatus === 'success' && oauthToken) {
          api.setTokens(oauthToken, oauthRefreshToken || undefined);
          if (oauthUserRaw) {
            try {
              const parsedUser = JSON.parse(decodeURIComponent(oauthUserRaw));
              if (parsedUser && parsedUser.id) {
                setUser(parsedUser);
              }
            } catch {}
          }
          // Limpa tokens da barra de endereços para segurança e UX impecável
          const cleanPath = window.location.pathname === '/auth/callback' ? '/' : window.location.pathname;
          window.history.replaceState({}, document.title, cleanPath);
        }
      }

      if (api.isAuthenticated()) {
        const u = await api.getMe();
        setUser(u);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Falha ao restaurar sessão:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await api.register(name, email, pass);
    setUser(res.user);
  };

  const loginWithWhatsApp = async (phone: string, code: string) => {
    const res = await api.verifyWhatsAppOTP(phone, code);
    setUser(res.user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithWhatsApp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  return ctx;
};
