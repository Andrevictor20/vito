import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { tokens } from './theme/tokens';
import { api, DEFAULT_SERVER_URL, CLOUDFLARE_SERVER_URL, PI_SERVER_URL, isCloudServer } from './services/api';
import { UpdateBanner } from './components/common/UpdateBanner';

const MainNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  useEffect(() => {
    // Sincroniza a URL ativa com a instância inicializada da API
    const current = api.getBaseUrl();
    if (current && current !== serverUrl) {
      setServerUrl(current);
    }
  }, [isLoading]);

  const toggleServer = async () => {
    const nextUrl = isCloudServer(serverUrl) ? PI_SERVER_URL : CLOUDFLARE_SERVER_URL;
    setServerUrl(nextUrl);
    await api.setBaseUrl(nextUrl);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <UpdateBanner />
      {user ? (
        <HomeScreen serverUrl={serverUrl} onToggleServer={toggleServer} />
      ) : (
        <AuthScreen serverUrl={serverUrl} onToggleServer={toggleServer} />
      )}
    </View>
  );
};

export const AppRoot: React.FC = () => {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
