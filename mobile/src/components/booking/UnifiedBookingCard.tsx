import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Share, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingType, Meeting, BookingAppointment, MeetingSlot } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import { formatSlotBRTDisplay, getLeadingSlot, buildMeetingShareMessage } from '../../utils/meetingPollUtils';
import { hapticFeedback } from '../../theme/motion';

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch (e) {
  ClipboardModule = null;
}

type BookingVariant = 'individual' | 'group' | 'appointment';

interface UnifiedBookingCardProps {
  variant: BookingVariant;
  // Common data
  id: string;
  title: string;
  subtitle?: string;
  status: 'active' | 'paused' | 'confirmed' | 'voting' | 'pending';
  isCopied?: boolean;
  // Variant-specific data
  duration?: number;           // individual
  window?: { start: string; end: string; buffer: number }; // individual
  url?: string;                // individual
  votes?: number;              // group
  leadingSlot?: { formatted: { dateLabel: string; timeRange: string }; votesCount: number; percentage: number } | null; // group
  isConfirmed?: boolean;       // group
  confirmedSlot?: { formatted: { dateLabel: string; timeRange: string } } | null; // group
  slotsCount?: number;         // group
  participantsCount?: number;  // group
  guestName?: string;          // appointment
  guestEmail?: string;         // appointment
  startAt?: string;            // appointment
  guestNotes?: string;         // appointment
  // Actions
  onPress?: () => void;
  onCopyLink?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onConfirm?: () => void;      // group only
  isDeleting?: boolean;        // appointment
  isConfirming?: boolean;      // group
}

const statusColors = {
  active: { bg: 'rgba(46, 125, 50, 0.12)', text: '#2e7d32', dot: '#2e7d32', label: 'Ativo' },
  paused: { bg: 'rgba(211, 47, 47, 0.12)', text: '#d32f2f', dot: '#d32f2f', label: 'Pausado' },
  confirmed: { bg: 'rgba(46, 125, 50, 0.14)', text: '#2e7d32', dot: '#2e7d32', label: 'Confirmada' },
  voting: { bg: 'rgba(52, 211, 153, 0.12)', text: '#10B981', dot: '#34D399', label: 'Em Votação' },
  pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', dot: '#FBBF24', label: 'Pendente' },
};

const sanitizeBookingUrl = (raw?: string, slug?: string): string => {
  const cleanSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
  const canonicalFallback = cleanSlug ? `https://vito.rasppi.cloud/book/${cleanSlug}` : 'https://vito.rasppi.cloud/book';
  if (!raw || !raw.trim()) return canonicalFallback;
  return raw;
};

export const UnifiedBookingCard: React.FC<UnifiedBookingCardProps> = ({
  variant,
  id,
  title,
  subtitle,
  status,
  isCopied,
  duration,
  window,
  url,
  votes,
  leadingSlot,
  isConfirmed,
  confirmedSlot,
  slotsCount,
  participantsCount,
  guestName,
  guestEmail,
  startAt,
  guestNotes,
  onPress,
  onCopyLink,
  onEdit,
  onDelete,
  onConfirm,
  isDeleting,
  isConfirming,
}) => {
  const { colors } = useTheme();
  const statusStyle = statusColors[status];
  const link = variant === 'group' ? meetingDisplayLink({ short_url: url } as any) : url;

  const handleShare = async () => {
    if (!link) return;
    try {
      const message = variant === 'group'
        ? buildMeetingShareMessage({ title, duration_minutes: duration, slots: [] } as any, link)
        : `Agende uma reunião comigo (${title} - ${duration} min):\n${sanitizeBookingUrl(link, '')}`;
      await Share.share({ message, url: link, title });
    } catch {}
  };

  const handlePress = () => {
    hapticFeedback.light();
    onPress?.();
  };

  const handleCopyLink = () => {
    hapticFeedback.selection();
    onCopyLink?.();
  };

  const handleEdit = () => {
    hapticFeedback.light();
    onEdit?.();
  };

  const handleDelete = () => {
    hapticFeedback.medium();
    onDelete?.();
  };

  const handleConfirm = () => {
    hapticFeedback.medium();
    onConfirm?.();
  };

  const renderHeader = () => (
    <View style={styles.cardHeader}>
      <View style={styles.cardTitleBlock}>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        {(variant === 'individual' || variant === 'group') && duration && (
          <View style={[styles.durationPill, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="schedule" size={12} color={colors.primary} />
            <Text style={[styles.durationPillText, { color: colors.onSurface }, tabularNumbers]}>{duration} min</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.statusPill,
          { backgroundColor: statusStyle.bg },
        ]}
        onPress={variant === 'individual' ? onPress : undefined}
        activeOpacity={0.7}
        disabled={variant !== 'individual'}
      >
        <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
        <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMeta = () => {
    if (variant === 'individual' && window) {
      return (
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="access-time" size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }, tabularNumbers]}>{window.start}–{window.end}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <MaterialIcons name="more-time" size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }, tabularNumbers]}>+{window.buffer}m</Text>
          </View>
        </View>
      );
    }
    if (variant === 'appointment' && startAt) {
      const dateObj = new Date(startAt);
      const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return (
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="event" size={12} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.onSurface }, tabularNumbers]}>{dateFormatted}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={12} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.onSurface }, tabularNumbers]}>{timeFormatted}</Text>
          </View>
        </View>
      );
    }
    if (variant === 'group') {
      return (
        <View style={styles.groupMetaRow}>
          {participantsCount !== undefined && (
            <View style={styles.metaItem}>
              <MaterialIcons name="people" size={12} color={colors.onSurfaceVariant} />
              <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>{participantsCount} {participantsCount === 1 ? 'participante' : 'participantes'}</Text>
            </View>
          )}
          {slotsCount !== undefined && (
            <View style={styles.metaDivider} />
          )}
          {slotsCount !== undefined && (
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={12} color={colors.onSurfaceVariant} />
              <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>{slotsCount} {slotsCount === 1 ? 'horário' : 'horários'}</Text>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  const renderUrl = () => {
    if (variant !== 'individual' || !url) return null;
    const displayUrl = sanitizeBookingUrl(url, '');
    return (
      <View style={[styles.urlContainer, { backgroundColor: colors.surfaceVariant }]}>
        <MaterialIcons name="public" size={12} color={colors.onSurfaceVariant} />
        <Text style={[styles.urlText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{displayUrl}</Text>
      </View>
    );
  };

  const renderLeadingSlot = () => {
    if (variant !== 'group') return null;
    if (isConfirmed && confirmedSlot?.formatted) {
      return (
        <View style={styles.leadingSlotRow}>
          <MaterialIcons name="check-circle" size={14} color="#2e7d32" />
          <Text style={[styles.leadingSlotText, { color: '#2e7d32' }]}>
            Confirmada para: <Text style={{ fontWeight: '700' }}>{confirmedSlot.formatted.dateLabel} às {confirmedSlot.formatted.timeRange}</Text>
          </Text>
        </View>
      );
    }
    if (leadingSlot?.formatted && leadingSlot.votesCount > 0) {
      return (
        <View style={styles.leadingSlotRow}>
          <MaterialIcons name="star" size={14} color={colors.primary} />
          <Text style={[styles.leadingSlotText, { color: colors.onSurface }]}>
            Liderando: <Text style={{ fontWeight: '700' }}>{leadingSlot.formatted.dateLabel} às {leadingSlot.formatted.timeRange}</Text> ({leadingSlot.votesCount} {leadingSlot.votesCount === 1 ? 'voto' : 'votos'} • {leadingSlot.percentage}%)
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.leadingSlotRow}>
        <MaterialIcons name="schedule" size={12} color={colors.textSecondary} />
        <Text style={[styles.emptySlotText, { color: colors.textSecondary }]}>Aguardando votos</Text>
      </View>
    );
  };

  const renderGuestInfo = () => {
    if (variant !== 'appointment') return null;
    return (
      <View style={styles.apptGuestInfo}>
        <Text style={[styles.guestName, { color: colors.onSurface }]}>{guestName}</Text>
        <Text style={[styles.guestEmail, { color: colors.onSurfaceVariant }]}>{guestEmail}</Text>
      </View>
    );
  };

  const renderGuestNotes = () => {
    if (variant !== 'appointment' || !guestNotes) return null;
    return (
      <View style={[styles.notesBox, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={[styles.notesText, { color: colors.onSurfaceVariant }]}>"{guestNotes}"</Text>
      </View>
    );
  };

  const renderConfirmedPill = () => {
    if (variant !== 'appointment') return null;
    return (
      <View style={[styles.confirmedPill, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
        <Text style={[styles.confirmedPillText, { color: '#2e7d32' }]}>Confirmado</Text>
      </View>
    );
  };

  const renderActions = () => {
    const actions: React.ReactNode[] = [];

    if (variant === 'individual') {
      actions.push(
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.outlineVariant }]} onPress={handleShare} activeOpacity={0.7}>
          <MaterialIcons name="share" size={14} color={colors.onSurface} />
        </TouchableOpacity>
      );
    }

    actions.push(
      <TouchableOpacity
        style={[
          styles.copyButton,
          { backgroundColor: isCopied ? '#2e7d32' : variant === 'individual' ? colors.primary : colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
        ]}
        onPress={handleCopyLink}
        activeOpacity={0.8}
        disabled={isConfirming}
      >
        <MaterialIcons name={isCopied ? 'check' : 'content-copy'} size={12} color={isCopied ? '#FFFFFF' : variant === 'individual' ? colors.onPrimary : colors.onSurface} />
        <Text style={[styles.copyButtonText, { color: isCopied ? '#FFFFFF' : variant === 'individual' ? colors.onPrimary : colors.onSurface }]}>{isCopied ? 'Copiado' : 'Copiar'}</Text>
      </TouchableOpacity>
    );

    if (variant !== 'appointment') {
      actions.push(
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.outlineVariant }]} onPress={handleEdit} activeOpacity={0.7}>
          <MaterialIcons name="edit" size={14} color={colors.onSurface} />
        </TouchableOpacity>
      );
    }

    if (variant === 'group' && onConfirm && !isConfirmed) {
      actions.push(
        <TouchableOpacity
          style={[
            styles.confirmButton,
            { backgroundColor: colors.primary, opacity: isConfirming ? 0.7 : 1 },
          ]}
          onPress={handleConfirm}
          disabled={isConfirming}
          activeOpacity={0.8}
        >
          <MaterialIcons name="event-available" size={14} color={colors.onPrimary} />
          <Text style={[styles.confirmButtonText, { color: colors.onPrimary }]}>Confirmar</Text>
        </TouchableOpacity>
      );
    }

    if (onDelete) {
      actions.push(
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.outlineVariant }]} onPress={handleDelete} activeOpacity={0.7}>
          <MaterialIcons name="delete-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      );
    }

    return <View style={styles.cardActionsRow}>{actions}</View>;
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          opacity: status === 'paused' ? 0.65 : 1,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={isDeleting}
    >
      {renderHeader()}
      {subtitle && <Text style={[styles.cardSubtitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{subtitle}</Text>}
      {renderGuestInfo()}
      {renderConfirmedPill()}
      {renderMeta()}
      {renderUrl()}
      {variant === 'group' && renderLeadingSlot()}
      {renderGuestNotes()}
      {renderActions()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: tokens.booking.cardPadding,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: tokens.booking.cardGap,
    marginBottom: tokens.booking.sectionGap,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: tokens.booking.titleSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: tokens.booking.metaSize,
    lineHeight: 16,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: MD3Shapes.small,
  },
  durationPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.booking.statusPillRadius,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '500',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#888',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urlText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '500',
    flex: 1,
  },
  leadingSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  leadingSlotText: {
    fontSize: tokens.booking.metaSize,
    flex: 1,
  },
  emptySlotText: {
    fontSize: tokens.booking.metaSize,
  },
  apptGuestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: tokens.booking.titleSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  guestEmail: {
    fontSize: tokens.booking.metaSize,
    marginTop: 1,
  },
  confirmedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.booking.statusPillRadius,
  },
  confirmedPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
  notesBox: {
    padding: 8,
    borderRadius: 6,
  },
  notesText: {
    fontSize: tokens.booking.metaSize,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionBtn: {
    width: tokens.booking.actionHeight,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    paddingHorizontal: 10,
    flex: 1,
  },
  copyButtonText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    paddingHorizontal: 10,
    flex: 1,
  },
  confirmButtonText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
});