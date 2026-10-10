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
   * Verifica o status real da permissão de notificação no sistema operacional.
   */
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
   * Inicializa os canais de notificação no Android com alta prioridade (Heads-Up).
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

        // 2. Canal Padrão (High priority - Heads-Up banner flutuante, som e vibração)
        await Notifications.setNotificationChannelAsync('vito_default', {
          name: 'Vito — Lembretes',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#3B82F6',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 3. Canal de Início Imediato / Urgente (Max priority - Pop-up de alta prioridade)
        await Notifications.setNotificationChannelAsync('vito_urgent', {
          name: 'Vito — Alertas Imediatos',
          importance: Notifications.AndroidImportance.MAX,
          enableVibrate: true,
          vibrationPattern: [0, 500, 250, 500],
          sound: 'default',
          lightColor: '#EF4444',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 4. Canal Wake-up Call (Max priority)
        await Notifications.setNotificationChannelAsync('vito_wakeup', {
          name: 'Vito — Wake-up Call',
          importance: Notifications.AndroidImportance.MAX,
          enableVibrate: true,
          vibrationPattern: [0, 500, 250, 500],
          sound: 'default',
          lightColor: '#EF4444',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      } catch {
        // Ignora silenciosamente em ambientes onde a API nativa de canais falhe
      }
    }
  },

  /**
   * Solicita permissões nativas e registra o Push Token.
   */
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
      const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_ONCE_KEY);
      // Se não for iniciado pelo usuário e já foi solicitado anteriormente, não reabre diálogo nativo
      if (!userInitiated && alreadyPrompted === 'true') {
        return { granted: false, pushToken: null, canAskAgain };
      }

      // Dispara solicitação nativa e registra que já foi solicitado
      await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    const isGranted = finalStatus === 'granted';
    if (!isGranted) {
      return { granted: false, pushToken: null, canAskAgain };
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
      console.warn('[NotificationService] Aviso ao obter Expo Push Token (notificações locais operantes):', err);
    }

    return { granted: true, pushToken, canAskAgain: true };
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
   * Agenda um lembrete local pontual (compatibilidade).
   */
  async scheduleEventReminder(params: ScheduleNotificationParams): Promise<string | null> {
    if (!this.isAvailable()) return null;
    const settings = await this.getSettings();
    if (!settings.enabled) return null;

    const priority: NotificationPriority = params.priority || settings.defaultPriority;
    const channelId = priority === 'silent' ? 'vito_silent' : 'vito_default';

    const minutesBefore = settings.reminderMinutesBefore || 10;
    const scheduledTime = new Date(params.triggerDate.getTime() - minutesBefore * 60 * 1000);

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
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
   * Agenda os dois lembretes (antecedência + início exato) para um compromisso.
   */
  async scheduleEventDualReminders(event: {
    id: string;
    title: string;
    start_at: string;
    category?: string;
    location?: string;
  }): Promise<{ advanceId: string | null; startId: string | null }> {
    if (!this.isAvailable()) return { advanceId: null, startId: null };
    const settings = await this.getSettings();
    if (!settings.enabled) return { advanceId: null, startId: null };

    const start = new Date(event.start_at).getTime();
    if (isNaN(start)) return { advanceId: null, startId: null };

    const now = Date.now();
    const minutesBefore = settings.reminderMinutesBefore || 10;
    const advanceTime = new Date(start - minutesBefore * 60 * 1000);
    const startTime = new Date(start);

    const priority: NotificationPriority = settings.defaultPriority;
    const channelId = priority === 'silent' ? 'vito_silent' : 'vito_default';
    const startChannelId = priority === 'silent' ? 'vito_silent' : 'vito_urgent';

    const emoji = getNotificationContextEmoji(event.title, event.category);
    const title = emoji ? `${emoji} ${event.title}` : event.title;

    let advanceId: string | null = null;
    let startId: string | null = null;

    // 1. Alerta de Antecedência (ex: 10 min antes)
    if (advanceTime.getTime() > now) {
      try {
        advanceId = await Notifications.scheduleNotificationAsync({
          identifier: `event-reminder-adv-${event.id}`,
          content: {
            title,
            body: `Começa em ${minutesBefore} minutos${event.location ? ' em ' + event.location : ''}`,
            sound: priority !== 'silent',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              eventId: event.id,
              type: 'advance',
              priority,
            },
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: advanceTime,
          },
        });
      } catch (err) {
        console.warn('[NotificationService] Erro ao agendar alerta de antecedência:', err);
      }
    }

    // 2. Alerta do Horário de Início (Começando agora)
    if (startTime.getTime() > now) {
      try {
        startId = await Notifications.scheduleNotificationAsync({
          identifier: `event-reminder-start-${event.id}`,
          content: {
            title,
            body: `Começando agora${event.location ? ' em ' + event.location : ''}!`,
            sound: priority !== 'silent',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: {
              eventId: event.id,
              type: 'start',
              priority,
            },
            ...(Platform.OS === 'android' ? { channelId: startChannelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: startTime,
          },
        });
      } catch (err) {
        console.warn('[NotificationService] Erro ao agendar alerta de início:', err);
      }
    }

    return { advanceId, startId };
  },

  /**
   * Reconcilia e agenda lembretes locais nativos (antecedência + início) para todos os compromissos futuros.
   */
  async scheduleAllUpcomingReminders(events: Array<{ id: string; title: string; start_at: string; category?: string; location?: string }>): Promise<number> {
    if (!this.isAvailable()) return 0;
    const settings = await this.getSettings();
    if (!settings.enabled) return 0;

    const now = Date.now();
    const maxWindow = now + 7 * 24 * 60 * 60 * 1000;
    let scheduledCount = 0;

    for (const event of events) {
      try {
        const start = new Date(event.start_at).getTime();
        if (isNaN(start) || start <= now || start > maxWindow) continue;

        const res = await this.scheduleEventDualReminders(event);
        if (res.advanceId || res.startId) {
          scheduledCount++;
        }
      } catch (err) {
        console.warn('[NotificationService] Falha ao agendar lembrete para evento:', event.id, err);
      }
    }
    return scheduledCount;
  },

  /**
   * Cancela todos os lembretes vinculados a um evento (legado, antecedência e início).
   */
  async cancelEventReminder(eventId: string): Promise<void> {
    if (!this.isAvailable()) return;
    await Promise.all([
      this.cancelNotification(`event-reminder-${eventId}`),
      this.cancelNotification(`event-reminder-adv-${eventId}`),
      this.cancelNotification(`event-reminder-start-${eventId}`),
    ]);
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
        : 'Alerta com som e banner em alta prioridade.';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: priority !== 'silent',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { priority, isTest: true },
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });
    } catch (e) {
      console.warn('[NotificationService] Erro ao disparar notificação de teste:', e);
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
