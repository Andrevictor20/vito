import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { ChatMeeting } from '../../../types';
import { formatMeetingMode, meetingDisplayLink } from '../../../utils/chatCards';

interface MeetingInlineCardProps {
  meeting: ChatMeeting;
}

export const MeetingInlineCard: React.FC<MeetingInlineCardProps> = ({ meeting }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const link = meetingDisplayLink(meeting);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[MeetingInlineCard] Falha ao copiar link:', e);
    }
  };

  const handleOpen = () => {
    if (!link) return;
    Linking.openURL(link).catch((e) => {
      console.warn('[MeetingInlineCard] Falha ao abrir link:', e);
    });
  };

  const handleWhatsApp = () => {
    const waUrl = meeting.whatsapp_url || (link ? `https://wa.me/?text=${encodeURIComponent(`Olá! Escolha ou vote no melhor horário para nossa reunião "${meeting.title}": ${link}`)}` : '');
    if (!waUrl) return;
    Linking.openURL(waUrl).catch((e) => {
      console.warn('[MeetingInlineCard] Falha ao abrir WhatsApp:', e);
    });
  };

  const isConsensus = meeting.mode === 'group_consensus';

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={[styles.accentBar, { backgroundColor: isConsensus ? colors.tertiary || colors.primary : colors.primary }]} />

      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name={isConsensus ? 'how-to-vote' : 'groups'} size={18} color={colors.primary} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {meeting.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {formatMeetingMode(meeting.mode)} · {meeting.duration_minutes} min{meeting.slots_count ? ` · ${meeting.slots_count} opções` : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.statusPill, { backgroundColor: colors.successLight }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.statusText, { color: colors.success }]}>
            {meeting.status === 'confirmed' ? 'Confirmada' : 'Aberta'}
          </Text>
        </View>
      </View>

      {link ? (
        <View style={[styles.linkBox, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="public" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.linkText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {link}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: copied ? colors.successLight : colors.surfaceContainerHighest },
          ]}
          onPress={handleCopy}
          disabled={!link}
          activeOpacity={0.8}
          accessibilityLabel="Copiar link da reunião"
        >
          <MaterialIcons name={copied ? 'check' : 'content-copy'} size={14} color={copied ? colors.success : colors.onSurface} />
          <Text style={[styles.actionButtonText, { color: copied ? colors.success : colors.onSurface }]}>
            {copied ? 'Copiado' : 'Copiar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#25D366' }]}
          onPress={handleWhatsApp}
          disabled={!link}
          activeOpacity={0.8}
          accessibilityLabel="Compartilhar no WhatsApp"
        >
          <MaterialIcons name="share" size={14} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleOpen}
          disabled={!link}
          activeOpacity={0.8}
          accessibilityLabel="Abrir link da reunião"
        >
          <MaterialIcons name="open-in-new" size={14} color={colors.onPrimary} />
          <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>Abrir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative',
    maxWidth: '100%',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: tokens.typography.family.medium,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: tokens.typography.family.regular,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.regular,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
