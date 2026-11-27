import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PrivacyPermissionsState } from '../services/storeComplianceApi';

let CalendarMod: {
  getCalendarPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  requestCalendarPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
} | null = null;
try {
  CalendarMod = require('expo-calendar');
} catch {
  CalendarMod = null;
}

let AudioMod: {
  getRecordingPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  requestRecordingPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  AudioModule?: {
    getRecordingPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
    requestRecordingPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  };
} | null = null;
try {
  AudioMod = require('expo-audio');
} catch {
  AudioMod = null;
}

let ContactsMod: {
  getPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  requestPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
} | null = null;
try {
  ContactsMod = require('expo-contacts');
} catch {
  ContactsMod = null;
}

function isPermGranted(res: { status?: string; granted?: boolean } | null | undefined): boolean {
  return Boolean(res && (res.granted || res.status === 'granted'));
}

export async function readOsPermissionsSnapshot(
  fallback: PrivacyPermissionsState,
): Promise<PrivacyPermissionsState> {
  const next: PrivacyPermissionsState = { ...fallback };
  try {
    const n = await Notifications.getPermissionsAsync();
    next.notifications = isPermGranted(n);
  } catch {}
  try {
    if (CalendarMod?.getCalendarPermissionsAsync) {
      next.calendar = isPermGranted(await CalendarMod.getCalendarPermissionsAsync());
    }
  } catch {}
  try {
    const fn = AudioMod?.getRecordingPermissionsAsync || AudioMod?.AudioModule?.getRecordingPermissionsAsync;
    if (fn) next.microphone = isPermGranted(await fn());
  } catch {}
  try {
    if (ContactsMod?.getPermissionsAsync) {
      next.contacts = isPermGranted(await ContactsMod.getPermissionsAsync());
    }
  } catch {}
  return next;
}

export async function requestOsPermission(key: keyof PrivacyPermissionsState): Promise<boolean | null> {
  try {
    if (key === 'notifications') {
      return isPermGranted(await Notifications.requestPermissionsAsync());
    }
    if (key === 'calendar' && CalendarMod?.requestCalendarPermissionsAsync) {
      return isPermGranted(await CalendarMod.requestCalendarPermissionsAsync());
    }
    if (key === 'microphone') {
      const fn =
        AudioMod?.requestRecordingPermissionsAsync || AudioMod?.AudioModule?.requestRecordingPermissionsAsync;
      if (fn) return isPermGranted(await fn());
    }
    if (key === 'contacts' && ContactsMod?.requestPermissionsAsync) {
      return isPermGranted(await ContactsMod.requestPermissionsAsync());
    }
  } catch {
    return false;
  }
  return null;
}

export async function openStoreAppRating(): Promise<void> {
  const httpsUrl = 'https://play.google.com/store/apps/details?id=com.andrevmp.vito';
  if (Platform.OS === 'android') {
    const marketUrl = 'market://details?id=com.andrevmp.vito';
    const supported = await Linking.canOpenURL(marketUrl).catch(() => false);
    if (supported) {
      await Linking.openURL(marketUrl);
      return;
    }
  }
  await Linking.openURL(httpsUrl);
}
