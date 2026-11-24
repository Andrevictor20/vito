import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';
import { APP_CATALOG_META } from '../../data/botsCatalogFallback';
import { Bot, BotPendingApproval, PendingResolutionDecision } from '../../types/bots';
import { formatTimeAgoPt, isAlwaysAskAction, resolveBotAnimState } from '../../utils/botsHelpers';
import { VitoSwitch } from '../ui/VitoSwitch';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface BotCardProps {
  bot: Bot;
  onPress: (bot: Bot) => void;
  onToggle: (bot: Bot) => void;
  onResolvePending: (
    botId: string,
    pending: BotPendingApproval,
    decision: PendingResolutionDecision
  ) => void;
  resolvingId?: string | null;
}

export const BotCard: React.FC<BotCardProps> = ({
  bot,
  onPress,
  onToggle,
  onResolvePending,
  resolvingId,
}) => {
  const { colors } = useTheme();
  const isActive = bot.status === 'active';
  const animState = resolveBotAnimState(bot);
  const firstPending = bot.pending?.[0];
  const canAlwaysAllow = firstPending
    ? !isAlwaysAskAction(firstPending.action_key, firstPending.always_ask)
    : false;
  const appKeys = (bot.apps && bot.apps.length > 0 ? bot.apps : ['vito']).slice(0, 4);
  const actionsCount = bot.actions?.length ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(bot)}
      style={[
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: firstPending ? colors.orange : colors.line,
          opacity: isActive ? 1 : 0.78,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Bot ${bot.title}`}
    >
      <View style={styles.topRow}>
        <BotMascotAvatar
          size={60}
          skin={bot.skin}
          skinJson={bot.skin_json}
          animState={animState}
          animated={false}
        />

        <View style={styles.infoCol}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {bot.title}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {bot.category} · {bot.trigger_label || 'Sob demanda'}
          </Text>
          <Text style={[styles.goal, { color: colors.muted }]} numberOfLines={2}>
            {bot.goal}
          </Text>
        </View>

        <View style={styles.switchWrap}>
          <VitoSwitch
            value={isActive}
            onValueChange={() => onToggle(bot)}
          />
        </View>
      </View>

      {firstPending && (
        <View
          style={[
            styles.pendBox,
            {
              backgroundColor: colors.orangeBg,
              borderColor: colors.orange,
            },
          ]}
        >
          <View style={styles.pendHeader}>
            <ProtoUiIcon name="pan-tool" size={14} color={colors.orange} />
            <Text style={[styles.pendTitle, { color: colors.ink }]} numberOfLines={1}>
              {firstPending.title || 'Aguardando aprovação'}
            </Text>
          </View>
          <Text style={[styles.pendSummary, { color: colors.muted }]} numberOfLines={2}>
            {firstPending.summary}
          </Text>
          <View style={styles.pendActions}>
            <TouchableOpacity
              style={[styles.pendBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
              onPress={() => onResolvePending(bot.id, firstPending, 'deny')}
              disabled={resolvingId === firstPending.confirmation_id}
            >
              <Text style={[styles.pendBtnText, { color: colors.red }]}>Recusar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pendBtn, { backgroundColor: colors.ink, borderColor: colors.ink }]}
              onPress={() => onResolvePending(bot.id, firstPending, 'allow_once')}
              disabled={resolvingId === firstPending.confirmation_id}
            >
              <Text style={[styles.pendBtnText, { color: colors.bg }]}>Aprovar</Text>
            </TouchableOpacity>

            {canAlwaysAllow && (
              <TouchableOpacity
                style={[styles.pendBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
                onPress={() => onResolvePending(bot.id, firstPending, 'always_allow')}
                disabled={resolvingId === firstPending.confirmation_id}
              >
                <Text style={[styles.pendBtnText, { color: colors.acc }]}>Sempre permitir</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {!!bot.last_line && (
        <Text style={[styles.lastLine, { color: colors.muted }]} numberOfLines={1}>
          {bot.last_line}
        </Text>
      )}

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <View style={styles.appStack}>
          {appKeys.map((appKey, idx) => {
            const meta = APP_CATALOG_META[appKey] ?? {
              name: appKey,
              color: colors.muted,
              short: appKey.slice(0, 2).toUpperCase(),
              icon: 'extension',
            };
            return (
              <View
                key={`${appKey}-${idx}`}
                style={[
                  styles.appBadge,
                  {
                    backgroundColor: meta.color,
                    borderColor: colors.bg,
                    marginLeft: idx === 0 ? 0 : -6,
                  },
                ]}
              >
                <Text style={styles.appBadgeText}>{meta.short}</Text>
              </View>
            );
          })}
          <Text style={[styles.timeAgo, { color: colors.muted }]}>
            {formatTimeAgoPt(bot.last_run_at)}
          </Text>
        </View>

        <View style={styles.actionsBadge}>
          <Text style={[styles.actionsText, { color: colors.muted }]}>
            {actionsCount} {actionsCount === 1 ? 'ação' : 'ações'}
          </Text>
          <ProtoUiIcon name="chevron-right" size={16} color={colors.muted} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  goal: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  switchWrap: {
    marginLeft: 4,
  },
  pendBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  pendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  pendSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  pendActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pendBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lastLine: {
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  timeAgo: {
    fontSize: 11,
    marginLeft: 8,
  },
  actionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionsText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
