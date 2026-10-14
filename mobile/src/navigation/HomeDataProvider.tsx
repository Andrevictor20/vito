import React, { createContext, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHomeData } from '../hooks/useHomeData';

type HomeData = ReturnType<typeof useHomeData>;

const HomeDataContext = createContext<HomeData | null>(null);

// MOB-03/MOB-02: dados compartilhados das abas via contexto (antes tudo no HomeScreen).
export const HomeDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const value = useHomeData(user?.id);
  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
};

export const useHomeDataContext = (): HomeData => {
  const ctx = useContext(HomeDataContext);
  if (!ctx) throw new Error('useHomeDataContext fora do HomeDataProvider');
  return ctx;
};
