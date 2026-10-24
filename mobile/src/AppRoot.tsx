import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigatorScreenParams, type LinkingOptions } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RootNavigator } from './navigation/RootNavigator';
import { navigationRef } from './navigation/navigationRef';
import { tokens } from './theme/tokens';
import { api, DEFAULT_SERVER_URL, CLOUDFLARE_SERVER_URL, PI_SERVER_URL, isCloudServer } from './services/api';
import { notificationService } from './services/notificationService';
import { UpdateBanner } from './components/common/UpdateBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PrivacyScreenShield } from './components/common/PrivacyScreenShield';

export type MainTabParamList = {
  chat: undefined;
  calendar: undefined;
  tasks: undefined;
  triggers: undefined;
  booking: undefined;
  profile: undefined;
};

export type RootStackParamList = {
  auth: undefined;
  main: NavigatorScreenParams<MainTabParamList>;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['vito://', 'https://vito.rasppi.cloud'],
  config: {
    screens: {
      auth: 'auth',
      main: {
        screens: {
          chat: 'chat',
          calendar: 'agenda',
          tasks: 'tarefas',
          triggers: 'radares',
          booking: 'booking',
          profile: 'perfil',
        },
      },
    },
  },
};

const MainNavigator: React.FC = () => {
  const { user, isInitialLoading } = useAuth();
  const { isDark, colors } = useTheme();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  useEffect(() => {
    if (user) {
      // Auto-registro e sincronização ativa de push token no backend Go
      notificationService.requestPermissions().then(() => {
        notificationService.syncPushTokenWithBackend().catch(() => {});
      }).catch(() => {});
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
      <NavigationContainer linking={linking} ref={navigationRef}>
        <RootNavigator serverUrl={serverUrl} onToggleServer={toggleServer} />
      </NavigationContainer>
      <PrivacyScreenShield />
    </View>
  );
};

import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { Montserrat_600SemiBold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';

export const AppRoot: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Montserrat_600SemiBold,
    Montserrat_800ExtraBold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontTimedOut) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#18181B' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MainNavigator />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
