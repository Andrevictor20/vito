import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { tokens } from './theme/tokens';
import { api, DEFAULT_SERVER_URL, CLOUDFLARE_SERVER_URL, PI_SERVER_URL, isCloudServer } from './services/api';
import { notificationService } from './services/notificationService';
import { UpdateBanner } from './components/common/UpdateBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const MainNavigator: React.FC = () => {
  const { user, isInitialLoading } = useAuth();
  const { isDark, colors } = useTheme();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  useEffect(() => {
    if (user) {
      // Auto-registro e inicialização de canais/push token
      notificationService.requestPermissions().catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    // Sincroniza a URL ativa com a instância inicializada da API
    const current = api.getBaseUrl();
    if (current && current !== serverUrl) {
      setServerUrl(current);
    }
  }, [isInitialLoading]);

  const toggleServer = async () => {
    const nextUrl = isCloudServer(serverUrl) ? PI_SERVER_URL : CLOUDFLARE_SERVER_URL;
    setServerUrl(nextUrl);
    await api.setBaseUrl(nextUrl);
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <UpdateBanner />
      {user ? (
        <HomeScreen serverUrl={serverUrl} onToggleServer={toggleServer} />
      ) : (
        <AuthScreen serverUrl={serverUrl} onToggleServer={toggleServer} />
      )}
    </View>
  );
};

import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

export const AppRoot: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#18181B' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <MainNavigator />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingTop: Platform.OS === 'android' ? Math.max((RNStatusBar.currentHeight || 0) + 6, 44) : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
