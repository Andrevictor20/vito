import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList, MainTabParamList } from '../AppRoot';

// Ref global p/ navegar a partir de listeners (push) fora de telas (§9.4).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToTab(tab: keyof MainTabParamList): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('main', { screen: tab });
  }
}
