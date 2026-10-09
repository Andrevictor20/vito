import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { api } from './api';
import { NotificationPriority, NotificationSettings, ScheduleNotificationParams } from '../types';

const SETTINGS_STORAGE_KEY = '@vito_notification_settings';
const PUSH_TOKEN_SECURE_KEY = '@vito_push_token';
const PROMPTED_ONCE_KEY = '@vito_notification_prompted_once';

export function getNotificationContextEmoji(title: string, category?: string): string | null {
  const t = title.toLowerCase();
  const c = (category || '').toLowerCase();

  if (/(\brem[eé]dio|\bmedicamento|\bcomprimido|\bantibi[oó]tico|\bp[ií]lula|\bdose|\bfarm[aá]cia|\breceita)/i.test(t)) {
    return '💊';
  }
  if (/(\b[aá]gua|\bhidratar|\bhidrata[cç][aã]o)/i.test(t)) {
    return '💧';
  }
  if (/(\bm[eé]dic[oa]|\bconsulta|\bexame|\bdentista|\bcardiologista|\bdermatologista|\bterapeuta|\bpsic[oó]logo|\bhospital|\bcl[ií]nica|\blaborat[oó]rio)/i.test(t)) {
    return '🩺';
  }
  if (/(\bacademia|\btreino|\btreinar|\bmuscula[cç][aã]o|\bcorrida|\bcorrer|\bcaminhada|\bpilates|\byoga|\bcrossfit|\bnata[cç][aã]o)/i.test(t)) {
    return '🏋️';
  }
  if (/(\balmo[cç]o|\balmo[cç]ar|\bjantar|\bjanta|\bcaf[eé] da manh[aã]|\brefei[cç][aã]o|\blanche|\brestaurante)/i.test(t)) {
    return '🍽️';
  }
  if (/(\bacordar|\bdespertar|\blevantar|\bdespertador)/i.test(t)) {
    return '⏰';
  }
  if (/(\baula|\bestudar|\bestudo|\bprova|\bcurso|\blivro|\bleitura|\bfaculdade|\bworkshop)/i.test(t)) {
    return '📚';
  }
  if (/(\bvoo|\bavi[aã]o|\baeroporto|\bviagem|\bembarque|\bhotel|\brodovi[aá]ria)/i.test(t)) {
    return '✈️';
  }
  if (/(\bcompras|\bmercado|\bsupermercado|\bcomprar|\bfeira|\bshopping|\bpadaria)/i.test(t)) {
    return '🛒';
  }
  if (/(\bboleto|\bpagar|\bpagamento|\bfatura|\bbanco|\bpix|\bimposto)/i.test(t)) {
    return '💳';
  }
  if (/(\banivers[aá]rio|\bparab[eé]ns|\bfesta|\bcomemora[cç][aã]o)/i.test(t)) {
    return '🎂';
  }
  if (/(\bcarro|\bve[ií]culo|\boficina|\bmec[aâ]nico|\brevis[aã]o do carro|\brevis[aã]o veicular|\bposto de gasolina|\bipva)/i.test(t)) {
    return '🚗';
  }
  if (/(\bpet|\bcachorro|\bc[aã]o|\bgato|\bveterin[aá]rio|\bra[cç][aã]o)/i.test(t)) {
    return '🐾';
  }

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
} catch (e) {
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

  /**
   * Inicializa os canais de notificação no Android e configurações M3.
   */
  async init(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    if (Platform.OS === 'android') {
      try {
        // 1. Canal Silencioso (Low priority)
        await Notifications.setNotificationChannelAsync('vito_silent', {
          name: 'Vito — Silencioso',
          importance: Notifications.AndroidImportance.LOW,
          enableVibrate: false,
          sound: null,
        });

        // 2. Canal Padrão (Normal priority)
        await Notifications.setNotificationChannelAsync('vito_default', {
          name: 'Vito — Lembretes',
          importance: Notifications.AndroidImportance.DEFAULT,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      } catch {
        // Ignora silenciosamente em ambientes onde a API nativa de canais falhe
      }
    }
  },

  /**
   * Solicita permissões nativas e registra o Push Token.
   */
  async requestPermissions(userInitiated: boolean = false): Promise<{ granted: boolean; pushToken: string | null }> {
    if (!this.isAvailable()) {
      return { granted: false, pushToken: null };
    }
    await this.init();

    if (Device && !Device.isDevice && Platform.OS !== 'web') {
      console.warn('[NotificationService] Notificações push requerem dispositivo físico.');
    }

    if (Platform.OS === 'web') {
      return { granted: false, pushToken: null };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_ONCE_KEY);
      // Se não for iniciado pelo usuário e já foi solicitado anteriormente, não reabre diálogo nativo
      if (!userInitiated && alreadyPrompted === 'true') {
        return { granted: false, pushToken: null };
      }

      // Dispara solicitação nativa e registra que já foi solicitado
      await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { granted: false, pushToken: null };
    }

    let pushToken: string | null = null;
    try {
      const projectId = 'b376b3f5-a93f-4f3e-a262-ddded8f96586';
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      pushToken = tokenData.data;

      if (pushToken) {
        // Salva em SecureStore com proteção de hardware
        await secureStorage.setItem(PUSH_TOKEN_SECURE_KEY, pushToken);

        // Registra o token no backend Go
        await api.registerPushToken(pushToken, Platform.OS).catch((err) => {
          console.warn('[NotificationService] Não foi possível sincronizar token com o backend:', err.message);
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Erro ao obter Expo Push Token:', err);
    }

    return { granted: true, pushToken };
  },

  /**
   * Obtém as configurações salvas de notificação.
   */
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

  /**
   * Salva as configurações de notificação do usuário.
   */
  async saveSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const current = await this.getSettings();
    const updated: NotificationSettings = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Agenda um lembrete local offline para um compromisso ou tarefa.
   */
  async scheduleEventReminder(params: ScheduleNotificationParams): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const settings = await this.getSettings();
    if (!settings.enabled) return null;

    const priority: NotificationPriority = params.priority || settings.defaultPriority;
    const channelId = priority === 'silent' ? 'vito_silent' : 'vito_default';

    // Determina o horário do disparo (subtraindo os minutos de antecedência)
    const minutesBefore = settings.reminderMinutesBefore || 10;
    const scheduledTime = new Date(params.triggerDate.getTime() - minutesBefore * 60 * 1000);

    // Se o horário calculado já passou, não agenda
    if (scheduledTime.getTime() <= Date.now()) {
      return null;
    }

    const emoji = getNotificationContextEmoji(params.title);
    const title = emoji ? `${emoji} ${params.title}` : params.title;

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: params.id,
      content: {
        title,
        body: params.body,
        sound: priority !== 'silent',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        data: {
          eventId: params.eventId,
          todoId: params.todoId,
          priority,
        },
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledTime,
      },
    });

    return notificationId;
  },

  /**
   * Reconcilia e agenda lembretes locais nativos para todos os compromissos futuros.
   */
  async scheduleAllUpcomingReminders(events: Array<{ id: string; title: string; start_at: string; category?: string; location?: string }>): Promise<number> {
    if (!this.isAvailable()) return 0;
    const settings = await this.getSettings();
    if (!settings.enabled) return 0;

    const now = Date.now();
    const minutesBefore = settings.reminderMinutesBefore || 10;
    let scheduledCount = 0;

    for (const event of events) {
      try {
        const start = new Date(event.start_at).getTime();
        if (isNaN(start)) continue;

        const scheduledTime = new Date(start - minutesBefore * 60 * 1000);
        if (scheduledTime.getTime() > now && scheduledTime.getTime() < now + 7 * 24 * 60 * 60 * 1000) {
          const priority: NotificationPriority = settings.defaultPriority;

          await this.scheduleEventReminder({
            id: `event-reminder-${event.id}`,
            eventId: event.id,
            title: event.title,
            body: `Começa em ${minutesBefore} minutos${event.location ? ' em ' + event.location : ''}`,
            triggerDate: new Date(start),
            priority,
          });
          scheduledCount++;
        }
      } catch (err) {
        console.warn('[NotificationService] Falha ao agendar lembrete para evento:', event.id, err);
      }
    }
    return scheduledCount;
  },

  async cancelEventReminder(eventId: string): Promise<void> {
    await this.cancelNotification(`event-reminder-${eventId}`);
  },

  /**
   * Cancela uma notificação agendada específica.
   */
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
      const channelId = priority === 'silent' ? 'vito_silent' : 'vito_default';
      const title = priority === 'silent'
        ? '[TESTE] Notificação Silenciosa'
        : '[TESTE] Notificação Vito';
      
      const body = priority === 'silent'
        ? 'Alerta sem som, mantendo total discrição.'
        : 'Lembrete emitido com sucesso pontual.';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: priority !== 'silent',
          data: { priority, isTest: true },
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger: null,
      });
    } catch {}
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
