import React from 'react';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../components/login/LoginScreen';
import { MainTabs } from './MainTabs';
import { HomeDataProvider } from './HomeDataProvider';
import { AiProvidersScreen } from '../screens/AiProvidersScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { StoreScreen } from '../screens/StoreScreen';
import { IntegrationsScreen } from '../screens/IntegrationsScreen';
import { BehaviorScreen } from '../screens/BehaviorScreen';
import { VoiceSettingsScreen } from '../screens/VoiceSettingsScreen';
import { MemoryScreen } from '../screens/MemoryScreen';
import type { RootStackParamList } from '../AppRoot';
import type { StorePage } from './screensNav';

export type ScreensStackParamList = RootStackParamList & {
  notifications: undefined;
  profile: undefined;
  booking: undefined;
  store: { page?: StorePage } | undefined;
  integrations: undefined;
  behavior: undefined;
  voiceSettings: undefined;
  memory: { from?: 'profile' | 'behavior' } | undefined;
};

const Stack = createNativeStackNavigator<ScreensStackParamList>();

export type AppNavigation = NativeStackNavigationProp<ScreensStackParamList>;

interface RootNavigatorProps {
  serverUrl: string;
  onToggleServer: () => void;
}

const ProfileStackWrapper: React.FC = () => <ProfileScreen showBackHeader />;
const BookingStackWrapper: React.FC = () => <BookingScreen showBackHeader />;

// MOB-02: AuthStack pública separada da área autenticada (MainTabs + sub-telas v5).
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
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="main" component={MainTabs} />
        <Stack.Screen name="notifications" component={NotificationsScreen} />
        <Stack.Screen name="profile" component={ProfileStackWrapper} />
        <Stack.Screen name="booking" component={BookingStackWrapper} />
        <Stack.Screen name="store" component={StoreScreen} />
        <Stack.Screen name="integrations" component={IntegrationsScreen} />
        <Stack.Screen name="aiProviders" component={AiProvidersScreen} />
        <Stack.Screen name="behavior" component={BehaviorScreen} />
        <Stack.Screen name="voiceSettings" component={VoiceSettingsScreen} />
        <Stack.Screen name="memory" component={MemoryScreen} />
      </Stack.Navigator>
    </HomeDataProvider>
  );
};
