import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { api } from './api';
import { NotificationPriority, NotificationSettings, ScheduleNotificationParams } from '../types';

const SETTINGS_STORAGE_KEY = '@vito_notification_settings';
const PUSH_TOKEN_SECURE_KEY = '@vito_push_token';

// Configuração canônica do manipulador de notificações em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const priority = notification.request.content.data?.priority as NotificationPriority | undefined;
    return {
      shouldShowAlert: true,
      shouldPlaySound: priority !== 'silent',
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  defaultPriority: 'default',
  reminderMinutesBefore: 10,
};

export const notificationService = {
  /**
   * Inicializa os canais de notificação no Android e configurações M3.
   */
  async init(): Promise<void> {
    if (Platform.OS === 'android') {
      // 1. Canal Silencioso (Low priority)
      await Notifications.setNotificationChannelAsync('vito_silent', {
        name: 'Vito — Silencioso',
        importance: Notifications.AndroidImportance.LOW,
        enableVibrate: false,
        sound: null,
      });

      // 2. Canal Padrão (Normal priority)
      await Notifications.setNotificationChannelAsync('vito_default', {
        name: 'Vito — Lembretes Padrão',
        importance: Notifications.AndroidImportance.DEFAULT,
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      // 3. Canal Wake-up Call (Prioridade Máxima, substituto de chamada telefônica)
      await Notifications.setNotificationChannelAsync('vito_wakeup', {
        name: 'Vito — Wake-up Call (Crítico)',
        importance: Notifications.AndroidImportance.MAX,
        enableVibrate: true,
        vibrationPattern: [0, 500, 250, 500, 250, 500, 250, 1000],
        sound: 'default',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  },

  /**
   * Solicita permissões nativas e registra o Push Token.
   */
  async requestPermissions(): Promise<{ granted: boolean; pushToken: string | null }> {
    if (!Device.isDevice && Platform.OS !== 'web') {
      console.warn('[NotificationService] Notificações push requerem dispositivo físico.');
    }

    if (Platform.OS === 'web') {
      return { granted: false, pushToken: null };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { granted: false, pushToken: null };
    }

    let pushToken: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      pushToken = tokenData.data;

      // Salva em SecureStore com proteção de hardware
      await secureStorage.setItem(PUSH_TOKEN_SECURE_KEY, pushToken);

      // Registra o token no backend Go
      await api.registerPushToken(pushToken, Platform.OS).catch((err) => {
        console.warn('[NotificationService] Não foi possível sincronizar token com o backend:', err.message);
      });
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
    const settings = await this.getSettings();
    if (!settings.enabled) return null;

    const priority: NotificationPriority = params.priority || settings.defaultPriority;
    const channelId = priority === 'wakeup' ? 'vito_wakeup' : priority === 'silent' ? 'vito_silent' : 'vito_default';

    // Determina o horário do disparo (subtraindo os minutos de antecedência)
    const minutesBefore = settings.reminderMinutesBefore || 10;
    const scheduledTime = new Date(params.triggerDate.getTime() - minutesBefore * 60 * 1000);

    // Se o horário calculado já passou, não agenda
    if (scheduledTime.getTime() <= Date.now()) {
      return null;
    }

    const titlePrefix = priority === 'wakeup' ? '🚨 [Wake-up Call] ' : '🔔 ';
    const title = `${titlePrefix}${params.title}`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: params.id,
      content: {
        title,
        body: params.body,
        sound: priority !== 'silent',
        priority: priority === 'wakeup' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT,
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
   * Cancela uma notificação agendada específica.
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  },

  /**
   * Cancela todas as notificações locais agendadas.
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Dispara uma notificação imediata para testar o comportamento do som e vibração.
   */
  async triggerTestNotification(priority: NotificationPriority): Promise<void> {
    const channelId = priority === 'wakeup' ? 'vito_wakeup' : priority === 'silent' ? 'vito_silent' : 'vito_default';
    const title = priority === 'wakeup'
      ? '🚨 [TESTE] Wake-up Call Crítico'
      : priority === 'silent'
        ? '🔕 [TESTE] Notificação Silenciosa'
        : '🔔 [TESTE] Notificação Padrão Vito';
    
    const body = priority === 'wakeup'
      ? 'Este alerta toca com prioridade máxima e vibração persistente para garantir seu despertar.'
      : priority === 'silent'
        ? 'Alerta sem som, mantendo total discrição.'
        : 'Lembrete padrão emitido com sucesso pontual.';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: priority !== 'silent',
        data: { priority, isTest: true },
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null, // Disparo imediato
    });
  },

  /**
   * Adiciona listener para notificação recebida em foreground.
   */
  addReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  /**
   * Adiciona listener para interação/clique do usuário na notificação.
   */
  addResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};
