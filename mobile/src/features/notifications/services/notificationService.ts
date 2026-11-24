import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../../../services/secureStore';
import { api } from '../../../services/api';
import { NotificationPriority, NotificationSettings } from '../../../types';
import { decideNotificationPermissionRequest } from '../utils/notificationPermissionPolicy';
import {
  buildVitoNotificationContent,
  registerVitoNotificationChannelsAndCategories,
  type VitoNotificationChannelId,
} from './notificationDesign';

const SETTINGS_STORAGE_KEY = '@vito_notification_settings';
const PUSH_TOKEN_SECURE_KEY = '@vito_push_token';
const PROMPTED_ONCE_KEY = '@vito_notification_prompted_once';

let legacySchedulesCleared = false;

export function getNotificationContextEmoji(title: string, category?: string): string | null {
  const t = title.toLowerCase();
  const c = (category || '').toLowerCase();

  if (/(\brem[eé]dio|\bmedicamento|\bcomprimido|\bantibi[oó]tico|\bp[ií]lula|\bdose|\bfarm[aá]cia|\breceita)/i.test(t)) return '💊';
  if (/(\b[aá]gua|\bhidratar|\bhidrata[cç][aã]o)/i.test(t)) return '💧';
  if (/(\bm[eé]dic[oa]|\bconsulta|\bexame|\bdentista|\bcardiologista|\bdermatologista|\bterapeuta|\bpsic[oó]logo|\bhospital|\bcl[ií]nica|\blaborat[oó]rio)/i.test(t)) return '🩺';
  if (/(\bacademia|\btreino|\btreinar|\bmuscula[cç][aã]o|\bcorrida|\bcorrer|\bcaminhada|\bpilates|\byoga|\bcrossfit|\bnata[cç][aã]o)/i.test(t)) return '🏋️';
  if (/(\balmo[cç]o|\balmo[cç]ar|\bjantar|\bjanta|\bcaf[eé] da manh[aã]|\brefei[cç][aã]o|\blanche|\brestaurante)/i.test(t)) return '🍽️';
  if (/(\bacordar|\bdespertar|\blevantar|\bdespertador)/i.test(t)) return '⏰';
  if (/(\baula|\bestudar|\bestudo|\bprova|\bcurso|\blivro|\bleitura|\bfaculdade|\bworkshop)/i.test(t)) return '📚';
  if (/(\bvoo|\bavi[aã]o|\baeroporto|\bviagem|\bembarque|\bhotel|\brodovi[aá]ria)/i.test(t)) return '✈️';
  if (/(\bcompras|\bmercado|\bsupermercado|\bcomprar|\bfeira|\bshopping|\bpadaria)/i.test(t)) return '🛒';
  if (/(\bboleto|\bpagar|\bpagamento|\bfatura|\bbanco|\bpix|\bimposto)/i.test(t)) return '💳';
  if (/(\banivers[aá]rio|\bparab[eé]ns|\bfesta|\bcomemora[cç][aã]o)/i.test(t)) return '🎂';
  if (/(\bcarro|\bve[ií]culo|\boficina|\bmec[aâ]nico|\brevis[aã]o do carro|\brevis[aã]o veicular|\bposto de gasolina|\bipva)/i.test(t)) return '🚗';
  if (/(\bpet|\bcachorro|\bc[aã]o|\bgato|\bveterin[aá]rio|\bra[cç][aã]o)/i.test(t)) return '🐾';

  if (c === 'health') return '🩺';
  if (c === 'study') return '📚';
  if (c === 'finance') return '💳';
  if (c === 'work') return '💼';

  return null;
}

let Notifications: any = null;
let Device: any = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const priority = notification?.request?.content?.data?.priority as NotificationPriority | undefined;
        return {
          shouldShowAlert: true,
          shouldPlaySound: priority !== 'silent',
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
  }
} catch {
  Notifications = null;
  Device = null;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  defaultPriority: 'default',
  reminderMinutesBefore: 10,
};

export const notificationService = {
  isAvailable(): boolean {
    return Platform.OS !== 'web' && Notifications !== null;
  },

  async checkPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean; status: string }> {
    if (!this.isAvailable()) {
      return { granted: false, canAskAgain: false, status: 'denied' };
    }
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain: canAskAgain ?? true,
        status,
      };
    } catch {
      return { granted: false, canAskAgain: true, status: 'undetermined' };
    }
  },

  /**
   * Inicializa os canais padrão Android/iOS e limpa agendamentos locais legados (fonte única = Backend Expo Push).
   */
  async init(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    if (!legacySchedulesCleared && typeof Notifications.cancelAllScheduledNotificationsAsync === 'function') {
      legacySchedulesCleared = true;
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }
    await registerVitoNotificationChannelsAndCategories(Notifications, Platform.OS === 'android');
  },

  async initNotifications(): Promise<void> {
    return this.init();
  },

  async syncPushTokenWithBackend(): Promise<{ success: boolean; pushToken: string | null; error?: string }> {
    if (!this.isAvailable() || Platform.OS === 'web') {
      return { success: false, pushToken: null, error: 'unsupported_platform' };
    }

    try {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        return { success: false, pushToken: null, error: 'permission_not_granted' };
      }

      const projectId = 'b376b3f5-a93f-4f3e-a262-ddded8f96586';
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenData?.data || null;

      if (pushToken) {
        await secureStorage.setItem(PUSH_TOKEN_SECURE_KEY, pushToken);
        if (api.getToken()) {
          await api.registerPushToken(pushToken, Platform.OS);
          console.log('[NotificationService] Push token sincronizado com sucesso no backend Go');
        }
        return { success: true, pushToken };
      }
      return { success: false, pushToken: null, error: 'empty_token' };
    } catch (err: any) {
      console.warn('[NotificationService] Falha ao obter Expo Push Token:', err?.message || err);
      try {
        const savedToken = await secureStorage.getItem(PUSH_TOKEN_SECURE_KEY);
        if (savedToken && api.getToken()) {
          await api.registerPushToken(savedToken, Platform.OS);
          return { success: true, pushToken: savedToken };
        }
      } catch {}
      return { success: false, pushToken: null, error: err?.message || 'unknown_error' };
    }
  },

  async hasAlreadyPrompted(): Promise<boolean> {
    try {
      const fromAsync = await AsyncStorage.getItem(PROMPTED_ONCE_KEY);
      if (fromAsync === 'true') return true;
    } catch {}
    try {
      const fromSecure = await secureStorage.getItem(PROMPTED_ONCE_KEY);
      if (fromSecure === 'true') return true;
    } catch {}
    return false;
  },

  async markPrompted(): Promise<void> {
    try {
      await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
    } catch {}
    try {
      await secureStorage.setItem(PROMPTED_ONCE_KEY, 'true');
    } catch {}
  },

  async requestPermissions(userInitiated: boolean = false): Promise<{ granted: boolean; pushToken: string | null; canAskAgain: boolean }> {
    if (!this.isAvailable()) {
      return { granted: false, pushToken: null, canAskAgain: false };
    }
    await this.init();

    if (Device && !Device.isDevice && Platform.OS !== 'web') {
      console.warn('[NotificationService] Notificações push requerem dispositivo físico.');
    }

    if (Platform.OS === 'web') {
      return { granted: false, pushToken: null, canAskAgain: false };
    }

    const { status: existingStatus, canAskAgain = true } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const alreadyAsked = await this.hasAlreadyPrompted();
      const decision = decideNotificationPermissionRequest({
        status: existingStatus as 'granted' | 'denied' | 'undetermined',
        canAskAgain,
        alreadyAsked,
        userInitiated,
      });

      if (decision.action === 'skip') {
        console.log(`[NotificationService] Pedido de permissão dispensado (${decision.reason}).`);
        return { granted: false, pushToken: null, canAskAgain };
      }

      await this.markPrompted();
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    const isGranted = finalStatus === 'granted';
    if (!isGranted) {
      return { granted: false, pushToken: null, canAskAgain };
    }

    const syncRes = await this.syncPushTokenWithBackend();
    return { granted: true, pushToken: syncRes.pushToken, canAskAgain: true };
  },

  async getSavedPushToken(): Promise<string | null> {
    return secureStorage.getItem(PUSH_TOKEN_SECURE_KEY);
  },

  async getSettings(): Promise<NotificationSettings> {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!json) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(json);
      const pushToken = await secureStorage.getItem(PUSH_TOKEN_SECURE_KEY);
      return { ...DEFAULT_SETTINGS, ...parsed, pushToken: pushToken || undefined };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const current = await this.getSettings();
    const updated: NotificationSettings = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  async cancelNotification(notificationId: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}
  },

  async cancelAllNotifications(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {}
  },

  async triggerTestNotification(priority: NotificationPriority): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const channelId: VitoNotificationChannelId = priority === 'silent' ? 'vito_silent' : 'vito_default';
      const title = priority === 'silent' ? 'Notificação silenciosa' : 'Notificação de teste';
      const body = priority === 'silent'
        ? 'Alerta discreto sem som · organização v5 ativa'
        : 'Alerta com som e banner · organização v5 ativa';

      await Notifications.scheduleNotificationAsync({
        content: buildVitoNotificationContent(
          {
            channelId,
            isAndroid: Platform.OS === 'android',
            subtitle: priority === 'silent' ? 'Silencioso' : 'Teste',
            title,
            body,
            sound: priority !== 'silent',
            priority: priority === 'silent' ? 'low' : 'high',
            data: { priority, isTest: true },
          },
          Notifications.AndroidNotificationPriority,
        ),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] Erro ao disparar notificação de teste:', e);
    }
  },

  async handleQuickActionResponse(response: any): Promise<boolean> {
    if (!this.isAvailable() || !response) return false;
    const actionId: string | undefined = response.actionIdentifier;
    if (actionId !== 'snooze_5m' && actionId !== 'snooze_15m') return false;

    const minutes = actionId === 'snooze_5m' ? 5 : 15;
    const orig = response.notification?.request?.content;
    const origData = (orig?.data || {}) as Record<string, unknown>;
    const channelId = (origData.channelId as VitoNotificationChannelId | undefined) || 'vito_default';

    try {
      await Notifications.scheduleNotificationAsync({
        content: buildVitoNotificationContent(
          {
            channelId,
            isAndroid: Platform.OS === 'android',
            subtitle: `${typeof orig?.subtitle === 'string' && orig.subtitle ? orig.subtitle : 'Lembrete'} · Adiado`,
            title: typeof orig?.title === 'string' && orig.title ? orig.title : 'Lembrete do Vito',
            body: typeof orig?.body === 'string' && orig.body ? orig.body : `Adiado por ${minutes} min`,
            sound: true,
            priority: 'high',
            data: { ...origData, snoozedMinutes: minutes },
          },
          Notifications.AndroidNotificationPriority,
        ),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60,
        },
      });
      return true;
    } catch (e) {
      console.warn('[NotificationService] Falha ao adiar notificação:', e);
      return false;
    }
  },

  async cancelAllUpcomingReminders(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (typeof Notifications.dismissAllNotificationsAsync === 'function') {
        await Notifications.dismissAllNotificationsAsync();
      }
    } catch (e) {
      console.warn('[NotificationService] Erro ao cancelar notificações locais:', e);
    }
  },

  addReceivedListener(callback: (notification: any) => void) {
    if (!this.isAvailable()) return { remove: () => {} };
    try {
      return Notifications.addNotificationReceivedListener(callback);
    } catch {
      return { remove: () => {} };
    }
  },

  addResponseListener(callback: (response: any) => void) {
    if (!this.isAvailable()) return { remove: () => {} };
    try {
      return Notifications.addNotificationResponseReceivedListener(callback);
    } catch {
      return { remove: () => {} };
    }
  },
};
