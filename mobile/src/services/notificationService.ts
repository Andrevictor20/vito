import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { api } from './api';
import { NotificationPriority, NotificationSettings, ScheduleNotificationParams, Event } from '../types';
import { isAllDayEvent, parseSafeDate } from '../utils/calendarDateUtils';
import { findOrphanNotificationIds, shouldSkipReschedulingEvent } from '../utils/notificationReconcile';
import { decideNotificationPermissionRequest } from '../utils/notificationPermissionPolicy';
import {
  buildVitoNotificationContent,
  registerVitoNotificationChannelsAndCategories,
  type VitoNotificationChannelId,
} from './notificationDesign';

const SETTINGS_STORAGE_KEY = '@vito_notification_settings';
const PUSH_TOKEN_SECURE_KEY = '@vito_push_token';
const PROMPTED_ONCE_KEY = '@vito_notification_prompted_once';

// Registro de idempotência em memória para alertas adaptativos e assinaturas já agendadas (evita re-disparo ao trocar abas/descartar banner)
const notifiedAdaptiveEventIds = new Set<string>();
const notifiedStartEventIds = new Set<string>();
const notifiedAdaptiveTodoIds = new Set<string>();
const scheduledEventSignatures = new Map<string, number>();
const scheduledTodoSignatures = new Map<string, number>();

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
   * Inicializa os grupos de canais, canais v5 e categorias de ações rápidas no Android/iOS.
   */
  async init(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    await registerVitoNotificationChannelsAndCategories(Notifications, Platform.OS === 'android');
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
   * Verifica se o diálogo nativo de permissão já foi exibido nesta instalação.
   * O flag é persistido nos dois storages (AsyncStorage + SecureStore) para sobreviver
   * à limpeza parcial de caches — objetivo: nunca repetir o pedido ao usuário.
   */
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

  /** Registra que o diálogo nativo já foi exibido (nos dois storages). */
  async markPrompted(): Promise<void> {
    try {
      await AsyncStorage.setItem(PROMPTED_ONCE_KEY, 'true');
    } catch {}
    try {
      await secureStorage.setItem(PROMPTED_ONCE_KEY, 'true');
    } catch {}
  },

  /**
   * Solicita permissões nativas e registra o Push Token.
   *
   * A política (decideNotificationPermissionRequest) garante que o diálogo do sistema
   * apareça **uma única vez por instalação**: no primeiro login ou quando o usuário
   * age explicitamente (toggle no Perfil). Logins seguintes nunca repetem o pedido.
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

      // Dispara solicitação nativa e registra que já foi solicitado
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
    const channelId: VitoNotificationChannelId = priority === 'silent' ? 'vito_silent' : 'vito_default';

    const minutesBefore = settings.reminderMinutesBefore || 10;
    const scheduledTime = new Date(params.triggerDate.getTime() - minutesBefore * 60 * 1000);

    if (scheduledTime.getTime() <= Date.now()) {
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: params.id,
      content: buildVitoNotificationContent(
        {
          channelId,
          isAndroid: Platform.OS === 'android',
          title: params.title,
          body: params.body,
          sound: priority !== 'silent',
          priority: priority === 'silent' ? 'low' : 'high',
          data: {
            eventId: params.eventId,
            todoId: params.todoId,
            priority,
          },
        },
        Notifications.AndroidNotificationPriority,
      ),
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

    const start = parseSafeDate(event.start_at).getTime();
    if (isNaN(start)) return { advanceId: null, startId: null };

    const now = Date.now();
    const diffMs = start - now;
    if (diffMs <= 0) return { advanceId: null, startId: null };

    // Se este evento já teve seus lembretes agendados com o mesmo horário de início nesta sessão,
    // não sobrescreve no SO (impede que notificações descartadas pelo usuário reapareçam a cada refresh).
    if (scheduledEventSignatures.get(event.id) === start) {
      return { advanceId: null, startId: null };
    }

    const minutesBefore = settings.reminderMinutesBefore || 10;
    const advanceMs = minutesBefore * 60 * 1000;

    const priority: NotificationPriority = settings.defaultPriority;
    const channelId: VitoNotificationChannelId = priority === 'silent' ? 'vito_silent' : 'vito_events';
    const startChannelId: VitoNotificationChannelId = priority === 'silent' ? 'vito_silent' : 'vito_urgent';
    const locationSuffix = event.location ? ` · ${event.location}` : '';

    let advanceId: string | null = null;
    let startId: string | null = null;

    // 1. Alerta de Antecedência
    if (diffMs > advanceMs) {
      // Cenário A: Tempo suficiente para agendar no horário prévio padrão
      const advanceTime = new Date(start - advanceMs);
      try {
        advanceId = await Notifications.scheduleNotificationAsync({
          identifier: `event-reminder-adv-${event.id}`,
          content: buildVitoNotificationContent(
            {
              channelId,
          isAndroid: Platform.OS === 'android',
              subtitle: 'Agenda',
              title: event.title,
              body: `Começa em ${minutesBefore} min${locationSuffix}`,
              sound: priority !== 'silent',
              priority: priority === 'silent' ? 'low' : 'high',
              categoryId: 'vito_event',
              data: {
                eventId: event.id,
                type: 'advance',
                priority,
              },
            },
            Notifications.AndroidNotificationPriority,
          ),
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
            content: buildVitoNotificationContent(
              {
                channelId,
          isAndroid: Platform.OS === 'android',
                subtitle: 'Agenda · Em breve',
                title: event.title,
                body: `Começa em ${minutesLeft} min${locationSuffix}`,
                sound: priority !== 'silent',
                priority: priority === 'silent' ? 'low' : 'high',
                categoryId: 'vito_event',
                data: {
                  eventId: event.id,
                  type: 'advance',
                  priority,
                },
              },
              Notifications.AndroidNotificationPriority,
            ),
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
    // Exige margem mínima de 15s no futuro e idempotência por event.id para evitar loop de disparo imediato
    if (diffMs > 15 * 1000 && !notifiedStartEventIds.has(event.id)) {
      try {
        startId = await Notifications.scheduleNotificationAsync({
          identifier: `event-reminder-start-${event.id}`,
          content: buildVitoNotificationContent(
            {
              channelId: startChannelId,
              isAndroid: Platform.OS === 'android',
              subtitle: 'Agenda · Agora',
              title: event.title,
              body: `Começando agora${locationSuffix}`,
              sound: priority !== 'silent',
              priority: 'max',
              categoryId: 'vito_event',
              data: {
                eventId: event.id,
                type: 'start',
                priority,
              },
            },
            Notifications.AndroidNotificationPriority,
          ),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(start),
          },
        });
        notifiedStartEventIds.add(event.id);
      } catch (err) {
        console.warn('[NotificationService] Erro ao agendar alerta de início:', err);
      }
    }

    if (advanceId || startId) {
      scheduledEventSignatures.set(event.id, start);
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

    const due = parseSafeDate(todo.due_date).getTime();
    if (isNaN(due)) return { advanceId: null, dueId: null };

    const now = Date.now();
    const diffMs = due - now;
    if (diffMs <= 0) return { advanceId: null, dueId: null };

    if (scheduledTodoSignatures.get(todo.id) === due) {
      return { advanceId: null, dueId: null };
    }

    const priority = todo.priority === 'high' ? 'urgent' : settings.defaultPriority;
    const channelId: VitoNotificationChannelId = 'vito_todos';

    let advanceId: string | null = null;
    let dueId: string | null = null;

    // Antecedência de 15 min para tarefas
    const advanceMs = 15 * 60 * 1000;
    if (diffMs > advanceMs) {
      const advTime = new Date(due - advanceMs);
      try {
        advanceId = await Notifications.scheduleNotificationAsync({
          identifier: `todo-reminder-adv-${todo.id}`,
          content: buildVitoNotificationContent(
            {
              channelId,
          isAndroid: Platform.OS === 'android',
              subtitle: 'Tarefas',
              title: todo.title,
              body: 'Prazo em 15 min',
              sound: priority !== 'silent',
              priority: 'high',
              categoryId: 'vito_todo',
              data: { todoId: todo.id, type: 'todo_advance', priority },
            },
            Notifications.AndroidNotificationPriority,
          ),
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
            content: buildVitoNotificationContent(
              {
                channelId,
          isAndroid: Platform.OS === 'android',
                subtitle: 'Tarefas · Em breve',
                title: todo.title,
                body: `Prazo encerra em ${minutesLeft} min`,
                sound: priority !== 'silent',
                priority: 'high',
                categoryId: 'vito_todo',
                data: { todoId: todo.id, type: 'todo_advance', priority },
              },
              Notifications.AndroidNotificationPriority,
            ),
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
    if (diffMs > 15 * 1000) {
      try {
        dueId = await Notifications.scheduleNotificationAsync({
          identifier: `todo-reminder-due-${todo.id}`,
          content: buildVitoNotificationContent(
            {
              channelId,
          isAndroid: Platform.OS === 'android',
              subtitle: 'Tarefas · Prazo agora',
              title: todo.title,
              body: 'O horário definido para esta tarefa chegou',
              sound: priority !== 'silent',
              priority: 'max',
              categoryId: 'vito_todo',
              data: { todoId: todo.id, type: 'todo_due', priority: 'urgent' },
            },
            Notifications.AndroidNotificationPriority,
          ),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(due),
          },
        });
      } catch (e) {
        console.warn('[NotificationService] Falha ao agendar prazo da tarefa:', e);
      }
    }

    if (advanceId || dueId) {
      scheduledTodoSignatures.set(todo.id, due);
    }

    return { advanceId, dueId };
  },

  /**
   * Cancela todos os lembretes vinculados a uma tarefa (antecedência e prazo).
   */
  async cancelTodoReminder(todoId: string): Promise<void> {
    if (!this.isAvailable()) return;
    notifiedAdaptiveTodoIds.delete(todoId);
    scheduledTodoSignatures.delete(todoId);
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

    const at = parseSafeDate(pending.remind_at).getTime();
    if (isNaN(at) || at <= Date.now()) return { mainId: null, advanceId: null };

    const channelId: VitoNotificationChannelId = 'vito_todos';
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
        content: buildVitoNotificationContent(
          {
            channelId,
          isAndroid: Platform.OS === 'android',
            subtitle: 'Pendências',
            title: pending.title,
            body: repeatMode === 'once' ? 'Hora de resolver esta pendência' : 'Lembrete recorrente de pendência',
            sound: true,
            priority: 'high',
            categoryId: 'vito_todo',
            data: { pendingId: pending.id, type: 'pending_reminder' },
          },
          Notifications.AndroidNotificationPriority,
        ),
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
          content: buildVitoNotificationContent(
            {
              channelId,
          isAndroid: Platform.OS === 'android',
              subtitle: 'Pendências · Em breve',
              title: pending.title,
              body: `Em ${advanceMin} min · hora de resolver`,
              sound: true,
              priority: 'high',
              categoryId: 'vito_todo',
              data: { pendingId: pending.id, type: 'pending_reminder_advance' },
            },
            Notifications.AndroidNotificationPriority,
          ),
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
    const seenBatchKeys = new Set<string>();
    let scheduledCount = 0;

    for (const event of (events || [])) {
      try {
        // Eventos de dia inteiro e feriados NÃO possuem alarme pontual de início / contagem regressiva
        if (isAllDayEvent(event as Event)) {
          this.cancelEventReminder(event.id).catch(() => {});
          continue;
        }

        const start = parseSafeDate(event.start_at).getTime();
        if (isNaN(start) || start <= now || start > maxWindow) continue;

        if (shouldSkipReschedulingEvent(event.id, start, scheduledEventSignatures, seenBatchKeys, event.title)) {
          continue;
        }

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
        const due = parseSafeDate(todo.due_date).getTime();
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
    notifiedStartEventIds.delete(eventId);
    scheduledEventSignatures.delete(eventId);
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
            if (eventId) {
              notifiedAdaptiveEventIds.delete(eventId);
              notifiedStartEventIds.delete(eventId);
              scheduledEventSignatures.delete(eventId);
            }
            if (todoId) {
              notifiedAdaptiveTodoIds.delete(todoId);
              scheduledTodoSignatures.delete(todoId);
            }
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
      const channelId: VitoNotificationChannelId = priority === 'silent' ? 'vito_silent' : 'vito_default';
      const title = priority === 'silent'
        ? 'Notificação silenciosa'
        : 'Notificação de teste';

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

  /**
   * Executa ações rápidas diretamente da barra de notificação (ex.: Adiar 5 min / Adiar 15 min).
   */
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

  /**
   * Cancela todas as notificações locais agendadas e remove banners ativos no dispositivo (utilizado no logout / troca de conta).
   */
  async cancelAllUpcomingReminders(): Promise<void> {
    if (!this.isAvailable()) return;
    notifiedAdaptiveEventIds.clear();
    notifiedStartEventIds.clear();
    notifiedAdaptiveTodoIds.clear();
    scheduledEventSignatures.clear();
    scheduledTodoSignatures.clear();
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
