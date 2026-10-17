import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Meeting, MeetingSlot } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import {
  formatSlotBRTDisplay,
  getLeadingSlot,
  buildMeetingShareMessage,
  getMeetingShareButtonLabel,
} from '../../utils/meetingPollUtils';
import { computeSubViewBottomPadding } from '../../utils/keyboardHeight';
import { hapticFeedback } from '../../theme/motion';
import { MeetingPollSlotItem } from './MeetingPollSlotItem';
import { MeetingPollHeroCard } from './MeetingPollHeroCard';

interface MeetingPollDetailViewProps {
  meeting: Meeting;
  onBack: () => void;
  onEdit?: (m: Meeting) => void;
  onConfirmSlot?: (meetingId: string, slotId: string) => Promise<void> | void;
  confirmingSlotId?: string | null;
  onDelete?: (id: string) => Promise<void> | void;
}

export const MeetingPollDetailView: React.FC<MeetingPollDetailViewProps> = ({
  meeting,
  onBack,
  onEdit,
  onConfirmSlot,
  confirmingSlotId,
  onDelete,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const link = meetingDisplayLink(meeting as any);
  const isConfirmed = meeting.status === 'confirmed';
  const slots: MeetingSlot[] = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
  const totalParticipants = participants.length;
  const leadingInfo = getLeadingSlot(slots, totalParticipants);

  // Tratamento do botão voltar físico do Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleShare = async () => {
    if (!link) return;
    try {
      const msg = buildMeetingShareMessage(meeting, link);
      await Share.share({
        message: msg,
        url: link,
        title: meeting.title,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
      {/* Top Bar de Navegação */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 8),
            backgroundColor: colors.surface,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surfaceContainerHigh }]}
          onPress={() => {
            hapticFeedback.light();
            onBack();
          }}
          activeOpacity={0.7}
          accessibilityLabel="Voltar para a lista de reuniões"
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.onSurface} />
          <Text style={[styles.backButtonText, { color: colors.onSurface }]}>Voltar</Text>
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          {onEdit && !isConfirmed && (
            <TouchableOpacity
              style={[styles.actionIconBtn, { borderColor: colors.outlineVariant }]}
              onPress={() => onEdit(meeting)}
              activeOpacity={0.7}
              accessibilityLabel="Editar reunião"
            >
              <MaterialIcons name="edit" size={17} color={colors.onSurface} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionIconBtn, { borderColor: colors.outlineVariant }]}
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityLabel="Compartilhar votação"
          >
            <MaterialIcons name="share" size={17} color={colors.onSurface} />
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              style={[styles.actionIconBtn, { borderColor: colors.outlineVariant }]}
              onPress={() => onDelete(meeting.id)}
              activeOpacity={0.7}
              accessibilityLabel="Excluir reunião"
            >
              <MaterialIcons name="delete-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: computeSubViewBottomPadding(insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card da Reunião */}
        <MeetingPollHeroCard
          meeting={meeting}
          isConfirmed={isConfirmed}
          totalParticipants={totalParticipants}
          link={link}
        />

        {/* Resumo do Consenso / Destaque */}
        {isConfirmed ? (
          <View style={[styles.alertBanner, { backgroundColor: 'rgba(46, 125, 50, 0.12)', borderColor: '#2e7d32' }]}>
            <MaterialIcons name="check-circle" size={20} color="#2e7d32" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertBannerTitle, { color: '#2e7d32' }]}>Consenso Definido!</Text>
              <Text style={[styles.alertBannerDesc, { color: colors.onSurface }]}>
                A reunião já foi fechada no horário escolhido e o compromisso foi gravado na sua agenda.
              </Text>
            </View>
          </View>
        ) : leadingInfo.votesCount > 0 ? (
          <View style={[styles.leaderBanner, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.primary }]}>
            <MaterialIcons name="star" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.leaderBannerTitle, { color: colors.primary }]}>Horário Mais Votado</Text>
              <Text style={[styles.leaderBannerDesc, { color: colors.onSurface }]}>
                {leadingInfo.formatted?.dateLabel} às {leadingInfo.formatted?.timeRange} — {leadingInfo.votesCount} {leadingInfo.votesCount === 1 ? 'voto' : 'votos'} ({leadingInfo.percentage}%)
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyVotesBanner, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="info-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={[styles.emptyVotesText, { color: colors.onSurfaceVariant }]}>
              Nenhum participante votou ainda. Compartilhe o link de votação para recolher a disponibilidade do grupo.
            </Text>
          </View>
        )}

        {/* Lista Completa de Horários Propostos */}
        <View style={styles.slotsContainer}>
          <View style={styles.slotsSectionHeader}>
            <Text style={[styles.slotsSectionTitle, { color: colors.onSurface }]}>
              Horários Propostos ({slots.length})
            </Text>
            <Text style={[styles.slotsSectionSub, { color: colors.textSecondary }]}>
              Toque em "Fechar" para definir o horário final
            </Text>
          </View>

          {slots.map((slot) => (
            <MeetingPollSlotItem
              key={slot.id}
              slot={slot}
              meetingId={meeting.id}
              confirmedSlotId={meeting.confirmed_slot_id}
              isConfirmed={isConfirmed}
              totalParticipants={totalParticipants}
              confirmingSlotId={confirmingSlotId}
              onConfirmSlot={onConfirmSlot}
            />
          ))}
        </View>

        {/* Botão de compartilhamento nativo padrão */}
        <TouchableOpacity
          style={[styles.whatsappBigBtn, { backgroundColor: colors.primary }]}
          onPress={handleShare}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={getMeetingShareButtonLabel(isConfirmed)}
        >
          <MaterialIcons name="share" size={18} color={colors.onPrimary} />
          <Text style={[styles.whatsappBigBtnText, { color: colors.onPrimary }]}>
            {getMeetingShareButtonLabel(isConfirmed)}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MD3Shapes.large,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  alertBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  alertBannerDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  leaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  leaderBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  leaderBannerDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyVotesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  emptyVotesText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  slotsContainer: {
    gap: 12,
  },
  slotsSectionHeader: {
    gap: 2,
  },
  slotsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  slotsSectionSub: {
    fontSize: 12,
  },
  whatsappBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: MD3Shapes.large,
    marginTop: 4,
  },
  whatsappBigBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
