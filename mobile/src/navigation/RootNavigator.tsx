import React from 'react';
import { Easing, View } from 'react-native';
import {
  createStackNavigator,
  type StackCardStyleInterpolator,
  type StackNavigationProp,
} from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CircularThemeRevealOverlay } from '../theme/vitoMotion';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { HomeDataProvider } from './HomeDataProvider';
import { AiProvidersScreen } from '../features/profile/screens/AiProvidersScreen';
import { NotificationsScreen } from '../features/notifications/screens/NotificationsScreen';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import { BookingScreen } from '../features/calendar/screens/BookingScreen';
import { StoreScreen } from '../features/store/screens/StoreScreen';
import { IntegrationsScreen } from '../features/profile/screens/IntegrationsScreen';
import { BehaviorScreen } from '../features/profile/screens/BehaviorScreen';
import { VoiceSettingsScreen } from '../features/profile/screens/VoiceSettingsScreen';
import { MemoryScreen } from '../features/profile/screens/MemoryScreen';
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

const Stack = createStackNavigator<ScreensStackParamList>();

export type AppNavigation = StackNavigationProp<ScreensStackParamList>;

interface RootNavigatorProps {
  serverUrl: string;
  onToggleServer: () => void;
}

const ProfileStackWrapper: React.FC = () => <ProfileScreen showBackHeader />;
const BookingStackWrapper: React.FC = () => <BookingScreen showBackHeader />;

/**
 * Transições de tela fiéis ao protótipo (#vito-motion):
 * - push: a tela nova entra de translateX(30) em 440ms ease-q; a anterior recua para -24px.
 * - pop: a tela que sai vai para translateX(30) em 400ms ease-q; a revelada entra de -22px.
 * Nenhuma animação nativa de plataforma é usada (animationEnabled é controlado pelo timing spec).
 */
const vitoCardInterpolator: StackCardStyleInterpolator = ({ current, next, closing }) => {
  if (next) {
    const translateX = next.progress.interpolate({
      inputRange: [0, 1],
      outputRange: closing ? [0, -24] : [0, -28],
    });
    const opacity = next.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.88],
    });
    return { cardStyle: { opacity, transform: [{ translateX }] } };
  }

  return {
    cardStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.85, 1],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [64, 0],
          }),
        },
      ],
    },
  };
};

const OPEN_SPEC = {
  animation: 'timing',
  config: { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) },
} as const;

const CLOSE_SPEC = {
  animation: 'timing',
  config: { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) },
} as const;

// MOB-02: AuthStack pública separada da área autenticada (MainTabs + sub-telas v5).
export const RootNavigator: React.FC<RootNavigatorProps> = ({ serverUrl, onToggleServer }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const screenOptions = {
    headerShown: false,
    animationEnabled: true,
    gestureEnabled: false,
    detachPreviousScreen: false,
    cardStyleInterpolator: vitoCardInterpolator,
    transitionSpec: { open: OPEN_SPEC, close: CLOSE_SPEC },
    cardStyle: { backgroundColor: colors.bg },
    cardShadowEnabled: false,
    cardOverlayEnabled: false,
  } as const;

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="auth">
            {() => <LoginScreen serverUrl={serverUrl} onToggleServer={onToggleServer} />}
          </Stack.Screen>
        </Stack.Navigator>
        <CircularThemeRevealOverlay />
      </View>
    );
  }

  return (
    <HomeDataProvider>
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={screenOptions}>
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
        <CircularThemeRevealOverlay />
      </View>
    </HomeDataProvider>
  );
};
