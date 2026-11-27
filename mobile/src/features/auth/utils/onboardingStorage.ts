import AsyncStorage from '@react-native-async-storage/async-storage'

export const ONBOARDING_SEEN_KEY = '@vito_onboarding_seen'
export const POST_LOGIN_PERMS_PROMPTED_KEY = '@vito_post_login_perms_prompted'
export const POST_LOGIN_PERMS_PREFS_KEY = '@vito_post_login_perms_prefs'

export interface PostLoginPermissionPrefs {
  notif: boolean
  cal: boolean
  mic: boolean
}

export const DEFAULT_PERM_PREFS: PostLoginPermissionPrefs = {
  notif: true,
  cal: true,
  mic: false,
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
    return val === '1'
  } catch {
    return false
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Falha silenciosa em ambientes sem storage
  }
}

export async function hasPromptedPostLoginPerms(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(POST_LOGIN_PERMS_PROMPTED_KEY)
    return val === '1'
  } catch {
    return false
  }
}

export async function markPostLoginPermsPrompted(prefs: PostLoginPermissionPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(POST_LOGIN_PERMS_PROMPTED_KEY, '1')
    await AsyncStorage.setItem(POST_LOGIN_PERMS_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Falha silenciosa em ambientes sem storage
  }
}
