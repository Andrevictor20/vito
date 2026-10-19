import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList, MainTabParamList } from '../AppRoot';
import { tabNavigationBus } from '../services/dataSync';
import type { MainTabType } from '../utils/pagerNavigation';

// Ref global p/ navegar a partir de listeners (push) fora de telas (§9.4).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToTab(tab: keyof MainTabParamList): void {
  tabNavigationBus.notify(tab as MainTabType);
  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate('main', { screen: tab });
    } catch {}
  }
}

