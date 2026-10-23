import React from 'react';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../components/login/LoginScreen';
import { MainTabs } from './MainTabs';
import { HomeDataProvider } from './HomeDataProvider';
import type { RootStackParamList } from '../AppRoot';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

interface RootNavigatorProps {
  serverUrl: string;
  onToggleServer: () => void;
}

// MOB-02: AuthStack pública separada da área autenticada (MainTabs).
export const RootNavigator: React.FC<RootNavigatorProps> = ({ serverUrl, onToggleServer }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth">
          {() => <LoginScreen serverUrl={serverUrl} onToggleServer={onToggleServer} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <HomeDataProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="main" component={MainTabs} />
      </Stack.Navigator>
    </HomeDataProvider>
  );
};
