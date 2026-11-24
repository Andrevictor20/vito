import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens as staticTokens, getThemeTokens, ThemeTokens, ThemeColors } from '../theme/tokens';
import { triggerThemeReveal } from '../theme/vitoMotion';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeRevealOrigin {
  x: number;
  y: number;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  tokens: ThemeTokens;
  colors: ThemeColors;
  toggleTheme: (origin?: ThemeRevealOrigin) => void;
  setThemeMode: (mode: ThemeMode, origin?: ThemeRevealOrigin) => void;
}

const THEME_STORAGE_KEY = '@vito_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [loaded, setLoaded] = useState(false);

  // Carregar preferência salva
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (err) {
        console.warn('[Theme] Falha ao carregar preferência de tema:', err);
      } finally {
        setLoaded(true);
      }
    };
    loadSavedTheme();
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const setThemeMode = async (mode: ThemeMode, origin?: ThemeRevealOrigin) => {
    const nextIsDark = mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
    if (nextIsDark !== isDark) {
      triggerThemeReveal({
        x: origin?.x,
        y: origin?.y,
        backgroundColor: nextIsDark ? '#0a0a0a' : '#ffffff',
        applyTheme: () => setThemeModeState(mode),
      });
    } else {
      setThemeModeState(mode);
    }
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('[Theme] Falha ao salvar preferência de tema:', err);
    }
  };

  const activeTokens = useMemo(() => {
    const t = getThemeTokens(isDark);
    // Sincroniza em tempo real o objeto estático tokens.colors para compatibilidade
    Object.assign(staticTokens.colors, t.colors);
    return t;
  }, [isDark]);

  const toggleTheme = (origin?: ThemeRevealOrigin) => {
    void setThemeMode(isDark ? 'light' : 'dark', origin);
  };

  const value = useMemo(
    () => ({
      themeMode,
      isDark,
      tokens: activeTokens,
      colors: activeTokens.colors,
      toggleTheme,
      setThemeMode,
    }),
    [themeMode, isDark, activeTokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider');
  }
  return context;
};

export function useThemedStyles<T>(factory: (tokens: ThemeTokens) => T): T {
  const { tokens } = useTheme();
  return useMemo(() => factory(tokens), [tokens]);
}
