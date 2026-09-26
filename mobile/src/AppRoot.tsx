import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { tokens } from './theme/tokens';
import { api, DEFAULT_SERVER_URL, CLOUDFLARE_SERVER_URL } from './services/api';

const MainNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  const toggleServer = async () => {
    const nextUrl = serverUrl.includes('localhost') ? CLOUDFLARE_SERVER_URL : DEFAULT_SERVER_URL;
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {user ? (
        <HomeScreen serverUrl={serverUrl} onToggleServer={toggleServer} />
      ) : (
        <AuthScreen />
      )}
    </SafeAreaView>
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
    backgroundColor: tokens.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
