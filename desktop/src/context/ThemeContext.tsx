import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  outline: string;
  primary: string;
  onPrimary: string;
  error: string;
  errorContainer: string;
  onErrorContainer: string;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = '@vito_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
    return 'dark';
  });

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return themeMode === 'dark';
  }, [themeMode]);

  // Sincroniza a classe 'dark' no <html> e salva preferência
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.style.colorScheme = 'light';
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
  }, [isDark, themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState(isDark ? 'light' : 'dark');
  };

  const colors: ThemeColors = useMemo(() => {
    if (isDark) {
      return {
        bg: '#0B0D10',
        surface: '#0B0D10',
        surfaceContainer: '#14171C',
        surfaceContainerHigh: '#1C2026',
        onSurface: '#FAFAFA',
        onSurfaceVariant: '#A1A1AA',
        outlineVariant: '#222730',
        outline: '#71717A',
        primary: '#FFFFFF',
        onPrimary: '#09090B',
        error: '#EF4444',
        errorContainer: 'rgba(239, 68, 68, 0.16)',
        onErrorContainer: '#FECDD3',
      };
    } else {
      return {
        bg: '#F8F9FA',
        surface: '#F8F9FA',
        surfaceContainer: '#FFFFFF',
        surfaceContainerHigh: '#F4F4F5',
        onSurface: '#09090B',
        onSurfaceVariant: '#52525B',
        outlineVariant: '#EAECEF',
        outline: '#D4D4D8',
        primary: '#18181B',
        onPrimary: '#FFFFFF',
        error: '#EF4444',
        errorContainer: '#FEE2E2',
        onErrorContainer: '#7F1D1D',
      };
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider');
  }
  return ctx;
};
