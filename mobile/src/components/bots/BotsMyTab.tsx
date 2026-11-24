import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { PressableScale } from '../../theme/vitoMotion';
import { useTheme } from '../../context/ThemeContext';
import { ASK_VITO_CHIPS } from '../../data/botsCatalogFallback';
import { Bot, BotActivityItem, BotPendingApproval, PendingResolutionDecision } from '../../types/bots';
import { formatTimeAgoPt } from '../../utils/botsHelpers';
import { BotCard } from './BotCard';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface BotsMyTabProps {
  bots: Bot[];
  activity: BotActivityItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOfflineCache: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpenBot: (bot: Bot) => void;
  onToggleBot: (bot: Bot) => void;
  onResolvePending: (
    botId: string,
    pending: BotPendingApproval,
    decision: PendingResolutionDecision
  ) => void;
  onAskVitoChip: (prompt: string) => void;
  onOpenCatalog: () => void;
  onOpenMascotStudio: () => void;
  resolvingId?: string | null;
}

export const BotsMyTab: React.FC<BotsMyTabProps> = ({
  bots,
  activity,
  loading,
  refreshing,
  error,
  isOfflineCache,
  onRefresh,
  onRetry,
  onOpenBot,
  onToggleBot,
  onResolvePending,
  onAskVitoChip,
  onOpenCatalog,
  onOpenMascotStudio,
  resolvingId,
}) => {
  const { colors } = useTheme();
  const activeBots = bots.filter((b) => b.status === 'active');
  const pausedBots = bots.filter((b) => b.status !== 'active');

  if (loading && bots.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.skeletonCard,
              { backgroundColor: colors.surf, borderColor: colors.line },
            ]}
          >
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.line }]} />
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLineLg, { backgroundColor: colors.line }]} />
              <View style={[styles.skeletonLineSm, { backgroundColor: colors.line }]} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error && bots.length === 0) {
    return (
      <View style={styles.centerBox}>
        <ProtoUiIcon name="cloud-off" size={40} color={colors.red} />
        <Text style={[styles.centerTitle, { color: colors.ink }]}>
          Não foi possível carregar seus bots
        </Text>
        <Text style={[styles.centerSub, { color: colors.muted }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
          onPress={onRetry}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg }]}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
      }
    >
      {isOfflineCache && (
        <View
          style={[
            styles.offlineBanner,
            { backgroundColor: colors.finBg, borderColor: colors.fin },
          ]}
        >
          <ProtoUiIcon name="wifi-off" size={16} color={colors.fin} />
          <Text style={[styles.offlineText, { color: colors.ink }]}>
            Sem conexão · exibindo cache local dos seus bots
          </Text>
        </View>
      )}

      {/* Bloco Peça ao Vito */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.askLabel, { color: colors.muted }]}>Peça ao Vito</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {ASK_VITO_CHIPS.map((chip) => (
            <PressableScale
              key={chip.label}
              style={[styles.chip, { backgroundColor: colors.surf }]}
              onPress={() => onAskVitoChip(chip.prompt)}
            >
              <Text style={[styles.chipText, { color: colors.ink }]}>{chip.label}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>

      {bots.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <BotMascotAvatar size={72} animState="idle" animated />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>
            Você ainda não ativou nenhum bot
          </Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            Escolha um bot pronto no catálogo ou personalize um mascote com uma função específica.
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
              onPress={onOpenCatalog}
            >
              <Text style={[styles.primaryBtnText, { color: colors.bg }]}>Explorar catálogo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { backgroundColor: colors.surf, borderColor: colors.line },
              ]}
              onPress={onOpenMascotStudio}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.ink }]}>Criar bot</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              ATIVOS {activeBots.length} DE {bots.length}
            </Text>
          </View>
          {activeBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onPress={onOpenBot}
              onToggle={onToggleBot}
              onResolvePending={onResolvePending}
              resolvingId={resolvingId}
            />
          ))}

          {pausedBots.length > 0 && (
            <View style={styles.pausedBlock}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>
                PAUSADOS ({pausedBots.length})
              </Text>
              {pausedBots.map((bot) => (
                <BotCard
                  key={bot.id}
                  bot={bot}
                  onPress={onOpenBot}
                  onToggle={onToggleBot}
                  onResolvePending={onResolvePending}
                  resolvingId={resolvingId}
                />
              ))}
            </View>
          )}
        </>
      )}

      {activity.length > 0 && (
        <View style={styles.activityBlock}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>ATIVIDADE RECENTE</Text>
          <View style={[styles.feedBox, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            {activity.slice(0, 8).map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.feedRow,
                  idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
                ]}
              >
                <View
                  style={[
                    styles.feedDot,
                    {
                      backgroundColor:
                        item.kind === 'error'
                          ? colors.red
                          : item.kind === 'pending'
                            ? colors.orange
                            : colors.acc,
                    },
                  ]}
                />
                <View style={styles.feedTextCol}>
                  <Text style={[styles.feedTitle, { color: colors.ink }]} numberOfLines={1}>
                    {item.bot_title}
                  </Text>
                  <Text style={[styles.feedDesc, { color: colors.muted }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                </View>
                <Text style={[styles.feedTime, { color: colors.muted }]}>
                  {formatTimeAgoPt(item.created_at)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 110,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  skeletonLineLg: {
    height: 16,
    borderRadius: 8,
    width: '70%',
  },
  skeletonLineSm: {
    height: 12,
    borderRadius: 6,
    width: '45%',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  centerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  askLabel: {
    fontFamily: 'Geist',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 0,
  },
  chipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pausedBlock: {
    marginTop: 8,
  },
  activityBlock: {
    marginTop: 14,
  },
  feedBox: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedTextCol: {
    flex: 1,
    gap: 2,
  },
  feedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  feedDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  feedTime: {
    fontSize: 11,
  },
});
