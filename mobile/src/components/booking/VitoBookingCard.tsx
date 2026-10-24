import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingType, Meeting } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import { buildMeetingShareMessage } from '../../utils/meetingPollUtils';

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch {
  ClipboardModule = null;
}

export interface VitoBookingCardProps {
  item:
    | { kind: 'individual'; data: BookingType }
    | { kind: 'group'; data: Meeting };
  isCopied?: boolean;
  username: string;
  onCopyLink: (url: string) => void;
  onEdit: (item: BookingType | Meeting) => void;
  onDuplicate?: (item: BookingType | Meeting) => void;
  onDelete: (id: string, kind: 'individual' | 'group') => void;
  onOpenVotingDetail?: (meeting: Meeting) => void;
  onToggleActive?: (bt: BookingType) => void;
}

export const VitoBookingCard: React.FC<VitoBookingCardProps> = ({
  item,
  isCopied = false,
  username,
  onCopyLink,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenVotingDetail,
  onToggleActive,
}) => {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const isGroup = item.kind === 'group';
  const data = item.data;

  // Metadata calculations
  let title = data.title;
  let duration = data.duration_minutes || 30;
  let statusText = 'Ativo';
  let isConfirmed = false;
  let confirmedLabel = '';
  let meta = '';
  let publicUrl = '';
  let description = data.description || '';

  if (isGroup) {
    const meeting = data as Meeting;
    isConfirmed = meeting.status === 'confirmed';
    statusText = isConfirmed ? 'Confirmada' : 'Ativo';
    const participantsCount = Array.isArray(meeting.participants)
      ? meeting.participants.length
      : 0;
    const slotsCount = Array.isArray(meeting.slots) ? meeting.slots.length : 0;
    meta = `Grupo · ${duration} min · ${participantsCount} participantes · ${slotsCount} horários`;

    publicUrl = meetingDisplayLink(meeting as any);

    if (isConfirmed && meeting.confirmed_slot_id && Array.isArray(meeting.slots)) {
      const slot = meeting.slots.find((s) => s.id === meeting.confirmed_slot_id);
      if (slot) {
        try {
          const d = new Date(slot.start_at);
          const dateStr = d.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          });
          const timeStr = d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          confirmedLabel = `${dateStr} · ${timeStr}`;
        } catch {
          confirmedLabel = 'Horário confirmado';
        }
      }
    }
  } else {
    const bt = data as BookingType;
    statusText = bt.is_active ? 'Ativo' : 'Pausado';
    const hours = `${bt.start_hour || '09:00'}–${bt.end_hour || '18:00'}`;
    const buf = `+${bt.buffer_minutes || 10} min`;
    meta = `1-on-1 · ${duration} min · ${hours} · ${buf}`;
    publicUrl =
      bt.short_url ||
      bt.public_url ||
      `https://vito.rasppi.cloud/book/${username}/${bt.slug}`;
  }

  const handleShare = async () => {
    try {
      const message = isGroup
        ? buildMeetingShareMessage(data as any, publicUrl)
        : `Agende uma reunião comigo (${title} - ${duration} min):\n${publicUrl}`;
      await Share.share({ message, url: publicUrl, title });
    } catch {}
  };

  const handleCopy = () => {
    onCopyLink(publicUrl);
  };

  return (
    <View
      style={[
        styles.bcard,
        {
          backgroundColor: colors.bg,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Header: Chip + Title + Status Pill */}
      <View style={styles.rtop}>
        <View style={[styles.chip, { backgroundColor: colors.tealBg }]}>
          <MaterialIcons
            name={isGroup ? 'groups' : 'link'}
            size={20}
            color={colors.teal}
          />
        </View>

        <View style={styles.titleWrap}>
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>

        <View style={[styles.pillst, { backgroundColor: colors.greenBg }]}>
          <View style={[styles.pillDot, { backgroundColor: colors.acc }]} />
          <Text
            style={[
              styles.pillstText,
              { color: colors.acc, fontFamily: tokens.typography.family.semibold },
            ]}
          >
            {statusText}
          </Text>
        </View>
      </View>

      {/* Meta string */}
      <Text style={[styles.meta, { color: colors.muted }]}>{meta}</Text>

      {/* Optional description */}
      {!!description && (
        <Text style={[styles.bdesc, { color: colors.muted }]} numberOfLines={2}>
          {description}
        </Text>
      )}

      {/* Confirmation green banner */}
      {isConfirmed && !!confirmedLabel && (
        <View style={[styles.okb, { backgroundColor: colors.greenBg }]}>
          <MaterialIcons name="check" size={16} color={colors.acc} />
          <Text
            style={[
              styles.okbText,
              { color: colors.acc, fontFamily: tokens.typography.family.semibold },
            ]}
          >
            Confirmada para {confirmedLabel}
          </Text>
        </View>
      )}

      {/* Public URL in pill container */}
      {!!publicUrl && (
        <View style={[styles.urlBox, { backgroundColor: colors.surf }]}>
          <Text style={[styles.urlText, { color: colors.muted }]} numberOfLines={1}>
            {publicUrl.replace(/^https?:\/\//, '')}
          </Text>
        </View>
      )}

      {/* Actions row: Share, Copiar link, Ver votação (if group), 3-dots */}
      <View style={styles.brow}>
        <TouchableOpacity
          style={[styles.rbs, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar"
        >
          <MaterialIcons name="share" size={18} color={colors.ink} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bbtn,
            styles.bbtnPrimary,
            { backgroundColor: colors.ink },
          ]}
          onPress={handleCopy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Copiar link"
        >
          <MaterialIcons
            name={isCopied ? 'check' : 'content-copy'}
            size={16}
            color={colors.bg}
          />
          <Text
            style={[
              styles.bbtnText,
              { color: colors.bg, fontFamily: tokens.typography.family.semibold },
            ]}
          >
            {isCopied ? 'Copiado!' : 'Copiar link'}
          </Text>
        </TouchableOpacity>

        {isGroup && (
          <TouchableOpacity
            style={[
              styles.bbtn,
              styles.bbtnGhost,
              { borderColor: colors.line, backgroundColor: colors.bg },
            ]}
            onPress={() => onOpenVotingDetail?.(data as Meeting)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ver votação"
          >
            <Text
              style={[
                styles.bbtnText,
                { color: colors.ink, fontFamily: tokens.typography.family.semibold },
              ]}
            >
              Ver votação
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.rbs, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => setMenuOpen(!menuOpen)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Mais ações"
        >
          <MaterialIcons name="more-horiz" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Expandable 3-dots menu */}
      {menuOpen && (
        <View
          style={[
            styles.menu,
            { backgroundColor: colors.bg, borderColor: colors.line },
          ]}
        >
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.line }]}
            onPress={() => {
              setMenuOpen(false);
              onEdit(data);
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.ink }]}>Editar</Text>
          </TouchableOpacity>

          {!isGroup && onToggleActive && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.line }]}
              onPress={() => {
                setMenuOpen(false);
                onToggleActive(data as BookingType);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.ink }]}>
                {(data as BookingType).is_active ? 'Pausar link' : 'Ativar link'}
              </Text>
            </TouchableOpacity>
          )}

          {onDuplicate && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.line }]}
              onPress={() => {
                setMenuOpen(false);
                onDuplicate(data);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.ink }]}>Duplicar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              onDelete(data.id, isGroup ? 'group' : 'individual');
            }}
          >
            <Text style={[styles.menuItemText, { color: colors.red }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bcard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: 'rgba(20,25,22,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  rtop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15.5,
    lineHeight: 20,
  },
  pillst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillstText: {
    fontSize: 12,
  },
  meta: {
    fontSize: 13,
    marginTop: 10,
    fontFamily: tokens.typography.family.regular,
  },
  bdesc: {
    fontSize: 13.5,
    marginTop: 6,
    fontFamily: tokens.typography.family.regular,
  },
  okb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  okbText: {
    fontSize: 13.5,
  },
  urlBox: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  urlText: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.regular,
  },
  brow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  rbs: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  bbtnPrimary: {},
  bbtnGhost: {
    borderWidth: 1.5,
  },
  bbtnText: {
    fontSize: 14,
  },
  menu: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.medium,
  },
});
