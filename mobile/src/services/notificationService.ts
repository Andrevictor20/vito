import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { api } from './api';
import { NotificationPriority, NotificationSettings, ScheduleNotificationParams, Event } from '../types';
import { isAllDayEvent } from '../utils/calendarDateUtils';
import { findOrphanNotificationIds } from '../utils/notificationReconcile';

const SETTINGS_STORAGE_KEY = '@vito_notification_settings';
const PUSH_TOKEN_SECURE_KEY = '@vito_push_token';
const PROMPTED_ONCE_KEY = '@vito_notification_prompted_once';

// Registro de idempotência em memória para alertas adaptativos em cima da hora
const notifiedAdaptiveEventIds = new Set<string>();
const notifiedAdaptiveTodoIds = new Set<string>();

export { findOrphanNotificationIds };

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

        // 3. Canal de Compromissos e Agenda
        await Notifications.setNotificationChannelAsync('vito_events', {
          name: 'Vito — Compromissos',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#3B82F6',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 4. Canal de Prazos e Tarefas
        await Notifications.setNotificationChannelAsync('vito_todos', {
          name: 'Vito — Tarefas e Prazos',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#10B981',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 5. Canal de Radares e Vigílias da Internet
        await Notifications.setNotificationChannelAsync('vito_radar', {
          name: 'Vito — Radares',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#8B5CF6',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 6. Canal de Agendamentos (Vito Booking)
        await Notifications.setNotificationChannelAsync('vito_booking', {
          name: 'Vito — Agendamentos',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#F59E0B',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 7. Canal de Resumos Executivos (Diário, Semanal e Mensal)
        await Notifications.setNotificationChannelAsync('vito_summaries', {
          name: 'Vito — Resumos Executivos',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          lightColor: '#6366F1',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 8. Canal de Início Imediato / Urgente (Max priority - Pop-up de alta prioridade)
        await Notifications.setNotificationChannelAsync('vito_urgent', {
          name: 'Vito — Alertas Imediatos',
          importance: Notifications.AndroidImportance.MAX,
          enableVibrate: true,
          vibrationPattern: [0, 500, 250, 500],
          sound: 'default',
          lightColor: '#EF4444',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 9. Canal Wake-up Call (Max priority)
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
   * Obtém o push token da Expo e garante sincronização ativa com o backend Go.
   */
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
      // Fallback: se já tínhamos um token salvo localmente, tenta registrá-lo no backend
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

    const syncRes = await this.syncPushTokenWithBackend();
    return { granted: true, pushToken: syncRes.pushToken, canAskAgain: true };
  },

  async getSavedPushToken(): Promise<string | null> {
    return secureStorage.getItem(PUSH_TOKEN_SECURE_KEY);
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
   * Agenda os dois lembretes (antecedência + início exato) para um compromisso com suporte adaptativo.
   */
  async scheduleEventDualReminders(event: {
    id: string;
    title: string;
    start_at: string;
    end_at?: string;
    category?: string;
    location?: string;
  }): Promise<{ advanceId: string | null; startId: string | null }> {
    if (!this.isAvailable()) return { advanceId: null, startId: null };

    // 0. Eventos de dia inteiro e feriados NÃO possuem alarme pontual de contagem regressiva de início
    if (isAllDayEvent(event as Event)) {
      await this.cancelEventReminder(event.id);
      return { advanceId: null, startId: null };
    }

    const settings = await this.getSettings();
    if (!settings.enabled) return { advanceId: null, startId: null };

    const start = new Date(event.start_at).getTime();
    if (isNaN(start)) return { advanceId: null, startId: null };

    const now = Date.now();
    const diffMs = start - now;
    if (diffMs <= 0) return { advanceId: null, startId: null };

    const minutesBefore = settings.reminderMinutesBefore || 10;
    const advanceMs = minutesBefore * 60 * 1000;

    const priority: NotificationPriority = settings.defaultPriority;
    const channelId = priority === 'silent' ? 'vito_silent' : 'vito_events';
    const startChannelId = priority === 'silent' ? 'vito_silent' : 'vito_urgent';

    const emoji = getNotificationContextEmoji(event.title, event.category);
    const title = emoji ? `${emoji} ${event.title}` : event.title;

    let advanceId: string | null = null;
    let startId: string | null = null;

    // 1. Alerta de Antecedência
    if (diffMs > advanceMs) {
      // Cenário A: Tempo suficiente para agendar no horário prévio padrão
      const advanceTime = new Date(start - advanceMs);
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
              channelId,
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
    } else if (diffMs > 2 * 60 * 1000) {
      // Cenário B (Em cima da hora: > 2 min e <= minutesBefore):
      // Idempotência estrita: se já despachamos o alerta adaptativo para este evento, não reenvia a cada loadData
      if (!notifiedAdaptiveEventIds.has(event.id)) {
        notifiedAdaptiveEventIds.add(event.id);
        const minutesLeft = Math.max(1, Math.round(diffMs / 60000));
        try {
          advanceId = await Notifications.scheduleNotificationAsync({
            identifier: `event-reminder-adv-${event.id}`,
            content: {
              title: `⚡ ${title}`,
              body: `Começa em ${minutesLeft} minutos${event.location ? ' em ' + event.location : ''}!`,
              sound: priority !== 'silent',
              priority: Notifications.AndroidNotificationPriority.HIGH,
              data: {
                eventId: event.id,
                type: 'advance',
                priority,
                channelId,
              },
              ...(Platform.OS === 'android' ? { channelId } : {}),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 3,
            },
          });
        } catch (err) {
          console.warn('[NotificationService] Erro ao agendar alerta adaptativo imediato:', err);
        }
      }
    }

    // 2. Alerta do Horário de Início (Começando agora)
    if (diffMs > 0) {
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
              channelId: startChannelId,
            },
            ...(Platform.OS === 'android' ? { channelId: startChannelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(start),
          },
        });
      } catch (err) {
        console.warn('[NotificationService] Erro ao agendar alerta de início:', err);
      }
    }

    return { advanceId, startId };
  },

  /**
   * Agenda lembretes locais para tarefas com prazo (antecedência + vencimento agora).
   */
  async scheduleTodoReminder(todo: {
    id: string;
    title: string;
    due_date?: string;
    priority?: string;
  }): Promise<{ advanceId: string | null; dueId: string | null }> {
    if (!this.isAvailable() || !todo.due_date) return { advanceId: null, dueId: null };
    const settings = await this.getSettings();
    if (!settings.enabled) return { advanceId: null, dueId: null };

    const due = new Date(todo.due_date).getTime();
    if (isNaN(due)) return { advanceId: null, dueId: null };

    const now = Date.now();
    const diffMs = due - now;
    if (diffMs <= 0) return { advanceId: null, dueId: null };

    const emoji = getNotificationContextEmoji(todo.title, 'todo') || '✓';
    const title = `${emoji} ${todo.title}`;
    const priority = todo.priority === 'high' ? 'urgent' : settings.defaultPriority;
    const channelId = 'vito_todos';

    let advanceId: string | null = null;
    let dueId: string | null = null;

    // Antecedência de 15 min para tarefas
    const advanceMs = 15 * 60 * 1000;
    if (diffMs > advanceMs) {
      const advTime = new Date(due - advanceMs);
      try {
        advanceId = await Notifications.scheduleNotificationAsync({
          identifier: `todo-reminder-adv-${todo.id}`,
          content: {
            title,
            body: 'Prazo em 15 minutos!',
            sound: priority !== 'silent',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { todoId: todo.id, type: 'todo_advance', priority, channelId },
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: advTime,
          },
        });
      } catch (e) {
        console.warn('[NotificationService] Falha ao agendar antecedência da tarefa:', e);
      }
    } else if (diffMs > 2 * 60 * 1000) {
      // Adaptativo imediato se vence em 2 a 15 min com idempotência estrita
      if (!notifiedAdaptiveTodoIds.has(todo.id)) {
        notifiedAdaptiveTodoIds.add(todo.id);
        const minutesLeft = Math.max(1, Math.round(diffMs / 60000));
        try {
          advanceId = await Notifications.scheduleNotificationAsync({
            identifier: `todo-reminder-adv-${todo.id}`,
            content: {
              title: `⏰ ${title}`,
              body: `Prazo se encerra em ${minutesLeft} minutos!`,
              sound: priority !== 'silent',
              priority: Notifications.AndroidNotificationPriority.HIGH,
              data: { todoId: todo.id, type: 'todo_advance', priority, channelId },
              ...(Platform.OS === 'android' ? { channelId } : {}),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 3,
            },
          });
        } catch (e) {
          console.warn('[NotificationService] Falha ao agendar alerta adaptativo da tarefa:', e);
        }
      }
    }

    // Alerta de Prazo Limite
    if (diffMs > 0) {
      try {
        dueId = await Notifications.scheduleNotificationAsync({
          identifier: `todo-reminder-due-${todo.id}`,
          content: {
            title: `⏰ Prazo da Tarefa: ${todo.title}`,
            body: 'O horário estipulado para esta tarefa chegou.',
            sound: priority !== 'silent',
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { todoId: todo.id, type: 'todo_due', priority: 'urgent', channelId },
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(due),
          },
        });
      } catch (e) {
        console.warn('[NotificationService] Falha ao agendar prazo da tarefa:', e);
      }
    }

    return { advanceId, dueId };
  },

  /**
   * Cancela todos os lembretes vinculados a uma tarefa (antecedência e prazo).
   */
  async cancelTodoReminder(todoId: string): Promise<void> {
    if (!this.isAvailable()) return;
    notifiedAdaptiveTodoIds.delete(todoId);
    await Promise.all([
      this.cancelNotification(`todo-reminder-adv-${todoId}`),
      this.cancelNotification(`todo-reminder-due-${todoId}`),
    ]);
  },

  /**
   * Agenda lembrete local personalizado de pendência (data/hora + repetição + aviso prévio).
   */
  async schedulePendingReminder(pending: {
    id: string;
    title: string;
    remind_at?: string;
    remind_repeat?: 'none' | 'daily' | 'weekly';
    remind_advance_minutes?: number;
  }): Promise<{ mainId: string | null; advanceId: string | null }> {
    if (!this.isAvailable() || !pending.remind_at) return { mainId: null, advanceId: null };
    const settings = await this.getSettings();
    if (!settings.enabled) return { mainId: null, advanceId: null };

    const at = new Date(pending.remind_at).getTime();
    if (isNaN(at) || at <= Date.now()) return { mainId: null, advanceId: null };

    const channelId = 'vito_todos';
    const emoji = getNotificationContextEmoji(pending.title, 'todo') || '📌';
    const atDate = new Date(at);
    const repeatMode = pending.remind_repeat === 'daily' ? 'daily' : pending.remind_repeat === 'weekly' ? 'weekly' : 'once';
    // Repetição usa gatilho de calendário (DATE não repete no expo-notifications).
    const trigger: any = repeatMode === 'once'
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atDate }
      : repeatMode === 'daily'
        ? { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: atDate.getHours(), minute: atDate.getMinutes(), repeats: true }
        : { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, weekday: atDate.getDay() + 1, hour: atDate.getHours(), minute: atDate.getMinutes(), repeats: true };
    let mainId: string | null = null;
    let advanceId: string | null = null;

    try {
      const res: any = await Notifications.scheduleNotificationAsync({
        identifier: `pending-reminder-${pending.id}`,
        content: {
          title: `${emoji} ${pending.title}`,
          body: repeatMode === 'once' ? 'Hora de resolver esta pendência.' : 'Lembrete de pendência (repete).',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { pendingId: pending.id, type: 'pending_reminder', channelId },
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger,
      });
      mainId = typeof res === 'string' ? res : `pending-reminder-${pending.id}`;
    } catch (e) {
      console.warn('[NotificationService] Falha ao agendar lembrete de pendência:', e);
    }

    const advanceMin = pending.remind_advance_minutes || 0;
    if (advanceMin > 0 && at - advanceMin * 60000 > Date.now()) {
      try {
        const res: any = await Notifications.scheduleNotificationAsync({
          identifier: `pending-reminder-adv-${pending.id}`,
          content: {
            title: `${emoji} ${pending.title}`,
            body: `Em ${advanceMin} minutos: hora de resolver.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { pendingId: pending.id, type: 'pending_reminder_advance', channelId },
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(at - advanceMin * 60000),
          },
        });
        advanceId = typeof res === 'string' ? res : `pending-reminder-adv-${pending.id}`;
      } catch (e) {
        console.warn('[NotificationService] Falha ao agendar aviso prévio de pendência:', e);
      }
    }

    return { mainId, advanceId };
  },

  /**
   * Cancela os lembretes personalizados de uma pendência.
   */
  async cancelPendingReminder(pendingId: string): Promise<void> {
    if (!this.isAvailable()) return;
    await Promise.all([
      this.cancelNotification(`pending-reminder-${pendingId}`),
      this.cancelNotification(`pending-reminder-adv-${pendingId}`),
    ]);
  },

  /**
   * Reconcilia e agenda lembretes locais nativos para compromissos e tarefas com data.
   */
  async scheduleAllUpcomingReminders(
    events: Array<{ id: string; title: string; start_at: string; end_at?: string; category?: string; location?: string }>,
    todos?: Array<{ id: string; title: string; due_date?: string; priority?: string; status?: string }>
  ): Promise<number> {
    if (!this.isAvailable()) return 0;
    const settings = await this.getSettings();
    if (!settings.enabled) return 0;

    const now = Date.now();
    const maxWindow = now + 7 * 24 * 60 * 60 * 1000;
    let scheduledCount = 0;

    for (const event of (events || [])) {
      try {
        // Eventos de dia inteiro e feriados NÃO possuem alarme pontual de início / contagem regressiva
        if (isAllDayEvent(event as Event)) {
          this.cancelEventReminder(event.id).catch(() => {});
          continue;
        }

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

    for (const todo of (todos || [])) {
      if (todo.status === 'completed' || !todo.due_date) continue;
      try {
        const due = new Date(todo.due_date).getTime();
        if (isNaN(due) || due <= now || due > maxWindow) continue;

        const res = await this.scheduleTodoReminder(todo);
        if (res.advanceId || res.dueId) {
          scheduledCount++;
        }
      } catch (err) {
        console.warn('[NotificationService] Falha ao agendar lembrete para tarefa:', todo.id, err);
      }
    }

    return scheduledCount;
  },

  /**
   * Cancela todos os lembretes vinculados a um evento (legado, antecedência e início).
   */
  async cancelEventReminder(eventId: string): Promise<void> {
    if (!this.isAvailable()) return;
    notifiedAdaptiveEventIds.delete(eventId);
    await Promise.all([
      this.cancelNotification(`event-reminder-${eventId}`),
      this.cancelNotification(`event-reminder-adv-${eventId}`),
      this.cancelNotification(`event-reminder-start-${eventId}`),
    ]);
  },

  /**
   * Purga órfãos: cancela agendados locais cujo eventId/todoId não existe mais no backend.
   * Cobre série excluída (N ids), delete via chat/outro device e cancel via Google inbound.
   */
  async reconcileOrphanReminders(
    fetchedEvents: Array<{ id: string }>,
    fetchedTodos?: Array<{ id: string; status?: string }>,
  ): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (!Array.isArray(scheduled) || scheduled.length === 0) return 0;
      const validEvents = new Set((fetchedEvents || []).map((e) => e.id));
      const validTodos = new Set(
        (fetchedTodos || []).filter((t) => t.status !== 'completed').map((t) => t.id),
      );
      const orphans = findOrphanNotificationIds(scheduled, validEvents, validTodos);
      const orphanSet = new Set(orphans);
      let purged = 0;
      for (const n of scheduled) {
        const data: { eventId?: string; todoId?: string } = n.content?.data || {};
        const eventId: string | undefined = data.eventId;
        const todoId: string | undefined = data.todoId;
        const identifier: string | undefined = n.identifier;
        if (identifier && orphanSet.has(identifier)) {
          try {
            await Notifications.cancelScheduledNotificationAsync(identifier);
            if (eventId) notifiedAdaptiveEventIds.delete(eventId);
            if (todoId) notifiedAdaptiveTodoIds.delete(todoId);
            purged++;
          } catch {}
        }
      }
      return purged;
    } catch {
      return 0;
    }
  },

  /**
   * Cancela em lote (série): garante que nenhum id da série volte a notificar.
   */
  async cancelEventReminders(eventIds: string[]): Promise<void> {
    if (!this.isAvailable() || !Array.isArray(eventIds)) return;
    await Promise.all(eventIds.map((id) => this.cancelEventReminder(id)));
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

  /**
   * Cancela todas as notificações locais agendadas no dispositivo (utilizado no logout / troca de conta).
   */
  async cancelAllUpcomingReminders(): Promise<void> {
    if (!this.isAvailable()) return;
    notifiedAdaptiveEventIds.clear();
    notifiedAdaptiveTodoIds.clear();
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
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
