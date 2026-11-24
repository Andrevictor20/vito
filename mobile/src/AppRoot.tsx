import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { NavigationContainer, NavigatorScreenParams, type LinkingOptions } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RootNavigator } from './navigation/RootNavigator';
import { navigationRef, navigateToTab } from './navigation/navigationRef';
import { tokens } from './theme/tokens';
import { api, DEFAULT_SERVER_URL, CLOUDFLARE_SERVER_URL, PI_SERVER_URL, isCloudServer } from './services/api';
import { notificationService } from './services/notificationService';
import { UpdateBanner } from './components/common/UpdateBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PrivacyScreenShield } from './components/common/PrivacyScreenShield';
import { SplashScreen } from './screens/SplashScreen';
import { PostLoginPermissionsSheet } from './components/auth/PostLoginPermissionsSheet';
import { hasPromptedPostLoginPerms } from './components/auth/onboardingStorage';

export type MainTabParamList = {
  chat: undefined;
  calendar: undefined;
  tasks: undefined;
  finance: undefined;
  triggers: undefined;
  booking: undefined;
  profile: undefined;
};

export type RootStackParamList = {
  auth: undefined;
  main: NavigatorScreenParams<MainTabParamList>;
  aiProviders: undefined;
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
          finance: 'financas',
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
  const [splashDone, setSplashDone] = useState(false);
  const [showPermsSheet, setShowPermsSheet] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = user?.id ?? null;
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = currentId;

    if (!currentId) {
      setShowPermsSheet(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    hasPromptedPostLoginPerms()
      .then((prompted) => {
        if (!prompted && !isInitialLoading && prevId === null) {
          timer = setTimeout(() => setShowPermsSheet(true), 650);
        } else if (prompted) {
          notificationService.syncPushTokenWithBackend().catch(() => {});
        }
      })
      .catch(() => {
        notificationService.syncPushTokenWithBackend().catch(() => {});
      });

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, isInitialLoading]);

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

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <UpdateBanner />
      {!isInitialLoading && (
        <NavigationContainer linking={linking} ref={navigationRef}>
          <RootNavigator serverUrl={serverUrl} onToggleServer={toggleServer} />
        </NavigationContainer>
      )}
      <PostLoginPermissionsSheet
        visible={Boolean(user) && showPermsSheet}
        onClose={() => setShowPermsSheet(false)}
      />
      {(isInitialLoading || !splashDone) && (
        <SplashScreen autoDismiss durationMs={2100} onFinish={() => setSplashDone(true)} />
      )}
      <PrivacyScreenShield />
    </View>
  );
};

import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium, GeistMono_600SemiBold, GeistMono_700Bold } from '@expo-google-fonts/geist-mono';

export const AppRoot: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts({
    Geist: Geist_400Regular,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    'Geist Mono': GeistMono_400Regular,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontTimedOut) {
    return (
      <ThemeProvider>
        <SplashScreen autoDismiss={false} />
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <MainNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
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
