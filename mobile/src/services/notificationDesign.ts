/**
 * Design e organização v5 das notificações nativas na barra do celular.
 * Alinhado à paleta e taxonomia de Vito-telas-atualizadas.html:
 * - Ícone monocromático oficial do mascote Vito com cartola (`notification_icon`)
 * - Cor de destaque esmeralda `--acc` (#0B7A53) e cores semânticas por domínio
 * - Canais Android organizados em 3 grupos claros
 * - Categorias de ações rápidas (Abrir / Adiar)
 * - Formatação editorial limpa (título sem ruído de emojis + subtitle de domínio)
 */

export const VITO_NOTIFICATION_ACCENT = '#0B7A53';

export type VitoNotificationChannelId =
  | 'vito_events'
  | 'vito_todos'
  | 'vito_booking'
  | 'vito_summaries'
  | 'vito_bots'
  | 'vito_radar'
  | 'vito_finance'
  | 'vito_default'
  | 'vito_urgent'
  | 'vito_wakeup'
  | 'vito_silent';

export type VitoNotificationCategoryId =
  | 'vito_event'
  | 'vito_todo'
  | 'vito_bot'
  | 'vito_finance';

export interface VitoChannelGroupSpec {
  id: string;
  name: string;
  description: string;
}

export interface VitoChannelSpec {
  id: VitoNotificationChannelId;
  groupId: string;
  name: string;
  description: string;
  importance: 'low' | 'high' | 'max';
  lightColor: string;
  vibrate: boolean;
  vibrationPattern?: number[];
  sound: 'default' | null;
  showBadge: boolean;
}

export interface VitoNotificationDomainMeta {
  subtitle: string;
  color: string;
  categoryId?: VitoNotificationCategoryId;
}

export const VITO_CHANNEL_GROUPS: readonly VitoChannelGroupSpec[] = [
  {
    id: 'vito_group_routine',
    name: 'Agenda e rotina',
    description: 'Compromissos, tarefas, agendamentos e resumos executivos',
  },
  {
    id: 'vito_group_automations',
    name: 'Bots e finanças',
    description: 'Alertas dos seus bots autônomos e movimentações financeiras',
  },
  {
    id: 'vito_group_system',
    name: 'Alertas e sistema',
    description: 'Lembretes gerais, alertas imediatos e modo silencioso',
  },
] as const;

export const VITO_NOTIFICATION_CHANNELS: readonly VitoChannelSpec[] = [
  {
    id: 'vito_events',
    groupId: 'vito_group_routine',
    name: 'Compromissos',
    description: 'Lembretes de reuniões e eventos da sua agenda',
    importance: 'high',
    lightColor: '#2563EB',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_todos',
    groupId: 'vito_group_routine',
    name: 'Tarefas e prazos',
    description: 'Avisos de tarefas e pendências com horário definido',
    importance: 'high',
    lightColor: '#7C3AED',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_booking',
    groupId: 'vito_group_routine',
    name: 'Agendamentos',
    description: 'Convites, confirmações e votos de reuniões',
    importance: 'high',
    lightColor: '#D97706',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_summaries',
    groupId: 'vito_group_routine',
    name: 'Resumos executivos',
    description: 'Briefings diários, semanais e mensais do Vito',
    importance: 'high',
    lightColor: '#0B7A53',
    vibrate: true,
    vibrationPattern: [0, 180],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_bots',
    groupId: 'vito_group_automations',
    name: 'Bots',
    description: 'Relatórios, novidades e pedidos de aprovação dos seus bots',
    importance: 'high',
    lightColor: '#0B7A53',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_radar',
    groupId: 'vito_group_automations',
    name: 'Bots — alertas automáticos',
    description: 'Alertas disparados por rotinas e monitoramentos dos bots',
    importance: 'high',
    lightColor: '#0B7A53',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_finance',
    groupId: 'vito_group_automations',
    name: 'Finanças',
    description: 'Faturas, orçamento mensal e sincronização Open Finance',
    importance: 'high',
    lightColor: '#0F766E',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_default',
    groupId: 'vito_group_system',
    name: 'Lembretes gerais',
    description: 'Notificações padrão do assistente Vito',
    importance: 'high',
    lightColor: '#0B7A53',
    vibrate: true,
    vibrationPattern: [0, 200, 140, 200],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_urgent',
    groupId: 'vito_group_system',
    name: 'Alertas imediatos',
    description: 'Eventos começando agora e prazos críticos',
    importance: 'max',
    lightColor: '#DC2626',
    vibrate: true,
    vibrationPattern: [0, 360, 180, 360],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_wakeup',
    groupId: 'vito_group_system',
    name: 'Wake-up Call',
    description: 'Chamadas prioritárias para compromissos inadiáveis',
    importance: 'max',
    lightColor: '#DC2626',
    vibrate: true,
    vibrationPattern: [0, 420, 200, 420],
    sound: 'default',
    showBadge: true,
  },
  {
    id: 'vito_silent',
    groupId: 'vito_group_system',
    name: 'Silencioso',
    description: 'Atualizações discretas sem som nem vibração',
    importance: 'low',
    lightColor: '#737373',
    vibrate: false,
    sound: null,
    showBadge: false,
  },
] as const;

export const NOTIFICATION_DOMAIN_META: Record<VitoNotificationChannelId, VitoNotificationDomainMeta> = {
  vito_events: { subtitle: 'Agenda', color: '#2563EB', categoryId: 'vito_event' },
  vito_todos: { subtitle: 'Tarefas', color: '#7C3AED', categoryId: 'vito_todo' },
  vito_booking: { subtitle: 'Agendamentos', color: '#D97706' },
  vito_summaries: { subtitle: 'Resumo', color: '#0B7A53' },
  vito_bots: { subtitle: 'Bots', color: '#0B7A53', categoryId: 'vito_bot' },
  vito_radar: { subtitle: 'Bots', color: '#0B7A53', categoryId: 'vito_bot' },
  vito_finance: { subtitle: 'Finanças', color: '#0F766E', categoryId: 'vito_finance' },
  vito_default: { subtitle: 'Vito', color: '#0B7A53' },
  vito_urgent: { subtitle: 'Agora', color: '#DC2626', categoryId: 'vito_event' },
  vito_wakeup: { subtitle: 'Alarme', color: '#DC2626' },
  vito_silent: { subtitle: 'Silencioso', color: '#595959' },
};

export interface VitoCategorySpec {
  id: VitoNotificationCategoryId;
  actions: ReadonlyArray<{
    identifier: string;
    buttonTitle: string;
    opensAppToForeground: boolean;
  }>;
}

export const VITO_NOTIFICATION_CATEGORIES: readonly VitoCategorySpec[] = [
  {
    id: 'vito_event',
    actions: [
      { identifier: 'open_item', buttonTitle: 'Abrir agenda', opensAppToForeground: true },
      { identifier: 'snooze_5m', buttonTitle: 'Adiar 5 min', opensAppToForeground: false },
    ],
  },
  {
    id: 'vito_todo',
    actions: [
      { identifier: 'open_item', buttonTitle: 'Abrir tarefas', opensAppToForeground: true },
      { identifier: 'snooze_15m', buttonTitle: 'Adiar 15 min', opensAppToForeground: false },
    ],
  },
  {
    id: 'vito_bot',
    actions: [{ identifier: 'open_item', buttonTitle: 'Ver bot', opensAppToForeground: true }],
  },
  {
    id: 'vito_finance',
    actions: [{ identifier: 'open_item', buttonTitle: 'Ver finanças', opensAppToForeground: true }],
  },
] as const;

export function sanitizeNotificationTitle(raw: string): string {
  return raw
    .replace(/^\s*(?:\[TESTE\]\s*)+/i, '')
    .replace(/^(?:⚡|⏰|📌|✓)\s*/gu, '')
    .trim();
}

export interface BuildNotificationContentInput {
  channelId: VitoNotificationChannelId;
  title: string;
  body: string;
  subtitle?: string;
  sound?: boolean;
  priority?: 'high' | 'max' | 'low';
  categoryId?: VitoNotificationCategoryId;
  data?: Record<string, unknown>;
  isAndroid?: boolean;
}

/**
 * Monta o payload de notificação local seguindo a organização visual v5:
 * título limpo, subtítulo de contexto (ex: Agenda · Tarefas · Bots),
 * cor semântica do domínio e categoria de ações rápidas.
 */
export function buildVitoNotificationContent(
  input: BuildNotificationContentInput,
  androidPriorityMap?: { LOW?: unknown; HIGH?: unknown; MAX?: unknown },
): Record<string, unknown> {
  const meta = NOTIFICATION_DOMAIN_META[input.channelId] ?? NOTIFICATION_DOMAIN_META.vito_default;
  const cleanTitle = sanitizeNotificationTitle(input.title) || input.title.trim();
  const resolvedPriority =
    input.priority === 'max'
      ? androidPriorityMap?.MAX
      : input.priority === 'low'
        ? androidPriorityMap?.LOW
        : androidPriorityMap?.HIGH;

  const content: Record<string, unknown> = {
    title: cleanTitle,
    subtitle: input.subtitle ?? meta.subtitle,
    body: input.body,
    color: meta.color,
    sound: input.sound ?? input.channelId !== 'vito_silent',
    data: {
      ...(input.data ?? {}),
      channelId: input.channelId,
      domainSubtitle: input.subtitle ?? meta.subtitle,
    },
  };

  if (resolvedPriority !== undefined) {
    content.priority = resolvedPriority;
  }

  const categoryIdentifier = input.categoryId ?? meta.categoryId;
  if (categoryIdentifier) {
    content.categoryIdentifier = categoryIdentifier;
  }

  if (input.isAndroid) {
    content.channelId = input.channelId;
  }

  return content;
}

export interface ExpoNotificationsLike {
  AndroidImportance?: { LOW?: unknown; HIGH?: unknown; MAX?: unknown };
  AndroidNotificationVisibility?: { PUBLIC?: unknown };
  setNotificationChannelGroupAsync?: (
    groupId: string,
    group: { name: string; description?: string },
  ) => Promise<unknown>;
  setNotificationChannelAsync?: (
    channelId: string,
    channel: Record<string, unknown>,
  ) => Promise<unknown>;
  setNotificationCategoryAsync?: (
    identifier: string,
    actions: Array<{
      identifier: string;
      buttonTitle: string;
      options?: { opensAppToForeground?: boolean };
    }>,
  ) => Promise<unknown>;
}

export async function registerVitoNotificationChannelsAndCategories(
  Notifications: ExpoNotificationsLike | null | undefined,
  isAndroid: boolean = false,
): Promise<void> {
  if (!Notifications) return;

  if (isAndroid) {
    if (typeof Notifications.setNotificationChannelGroupAsync === 'function') {
      for (const group of VITO_CHANNEL_GROUPS) {
        try {
          await Notifications.setNotificationChannelGroupAsync(group.id, {
            name: group.name,
            description: group.description,
          });
        } catch {
          // Ignora silenciosamente em ambientes sem suporte a grupos de canal
        }
      }
    }

    if (typeof Notifications.setNotificationChannelAsync === 'function') {
      const impMap = {
        low: Notifications.AndroidImportance?.LOW,
        high: Notifications.AndroidImportance?.HIGH,
        max: Notifications.AndroidImportance?.MAX,
      };
      const visPublic = Notifications.AndroidNotificationVisibility?.PUBLIC;

      for (const ch of VITO_NOTIFICATION_CHANNELS) {
        try {
          await Notifications.setNotificationChannelAsync(ch.id, {
            name: ch.name,
            description: ch.description,
            groupId: ch.groupId,
            importance: impMap[ch.importance],
            enableVibrate: ch.vibrate,
            ...(ch.vibrationPattern ? { vibrationPattern: ch.vibrationPattern } : {}),
            sound: ch.sound,
            lightColor: ch.lightColor,
            showBadge: ch.showBadge,
            ...(visPublic !== undefined ? { lockscreenVisibility: visPublic } : {}),
          });
        } catch {
          // Ignora silenciosamente se API nativa falhar
        }
      }
    }
  }

  if (typeof Notifications.setNotificationCategoryAsync === 'function') {
    for (const cat of VITO_NOTIFICATION_CATEGORIES) {
      try {
        await Notifications.setNotificationCategoryAsync(
          cat.id,
          cat.actions.map((a) => ({
            identifier: a.identifier,
            buttonTitle: a.buttonTitle,
            options: { opensAppToForeground: a.opensAppToForeground },
          })),
        );
      } catch {
        // Ignora se plataforma não suportar categorias interativas
      }
    }
  }
}
