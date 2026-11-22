import { navigationRef, navigateToTab } from './navigationRef';

export type StorePage = 'pro' | 'priv' | 'notif' | 'help' | 'about';

export type ScreensRouteName =
  | 'notifications'
  | 'profile'
  | 'booking'
  | 'store'
  | 'integrations'
  | 'aiProviders'
  | 'behavior'
  | 'voiceSettings'
  | 'memory';

export function navigateToScreen(
  name: ScreensRouteName,
  params?: Record<string, unknown>
): void {
  if (!navigationRef.isReady()) return;
  try {
    (navigationRef as { navigate: (n: string, p?: unknown) => void }).navigate(name, params);
  } catch {
    // Ignora falha caso navegador ainda esteja montando
  }
}

export function navigateToNotifications(): void {
  navigateToScreen('notifications');
}

export function navigateToProfile(): void {
  navigateToScreen('profile');
}

export function navigateToBooking(): void {
  navigateToScreen('booking');
}

export function navigateToStore(page: StorePage = 'pro'): void {
  navigateToScreen('store', { page });
}

export { navigateToTab };
