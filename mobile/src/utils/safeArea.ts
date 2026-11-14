import { Platform, StatusBar } from 'react-native';

const ANDROID_STATUS_BAR_FALLBACK = 28;
const ANDROID_NAV_BAR_FALLBACK = 12;

/**
 * Resolve padding superior para modais em tela cheia com `statusBarTranslucent`,
 * garantindo fallback no Android caso o Dialog inicialize antes de `SafeAreaProvider`.
 */
export function resolveModalTopInset(insetsTop: number, extra = 0): number {
  const androidFallback = Platform.OS === 'android' ? (StatusBar.currentHeight ?? ANDROID_STATUS_BAR_FALLBACK) : 0;
  return Math.max(insetsTop, androidFallback) + extra;
}

/** Resolve padding inferior seguro para modais em tela cheia no Android e iOS. */
export function resolveModalBottomInset(insetsBottom: number, extra = 0): number {
  const androidFallback = Platform.OS === 'android' ? ANDROID_NAV_BAR_FALLBACK : 0;
  return Math.max(insetsBottom, androidFallback) + extra;
}
