import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';
import { BookingType, Meeting } from '../../types';
import { VitoBookingCard } from './VitoBookingCard';
import { meetingDisplayLink } from '../../utils/chatCards';
import { buildMeetingShareMessage } from '../../utils/meetingPollUtils';

export interface BookingLinksTabProps {
  types: BookingType[];
  meetings: Meeting[];
  username: string;
  refreshing: boolean;
  onRefresh: () => void;
  onCopyLink: (url: string) => void;
  onEditType: (bt: BookingType) => void;
  onEditMeeting: (m: Meeting) => void;
  onDuplicateType?: (bt: BookingType) => void;
  onDuplicateMeeting?: (m: Meeting) => void;
  onDeleteType: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onOpenVotingDetail: (meeting: Meeting) => void;
  onToggleActiveType: (bt: BookingType) => void;
  onCreateNew: () => void;
}

export const BookingLinksTab: React.FC<BookingLinksTabProps> = ({
  types,
  meetings,
  username,
  refreshing,
  onRefresh,
  onCopyLink,
  onEditType,
  onEditMeeting,
  onDuplicateType,
  onDuplicateMeeting,
  onDeleteType,
  onDeleteMeeting,
  onOpenVotingDetail,
  onToggleActiveType,
  onCreateNew,
}) => {
  const { colors } = useTheme();
  const [showVitoSuggestion, setShowVitoSuggestion] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const totalCount = types.length + meetings.length;

  // Encontrar o link mais relevante para a sugestão inteligente
  const suggestedItem =
    meetings.find((m) => m.status !== 'confirmed') ||
    meetings[0] ||
    types[0];

  const handleSendViaWhatsApp = async () => {
    setShowVitoSuggestion(false);
    if (!suggestedItem) return;

    const isGroup = 'slots' in suggestedItem;
    const title = suggestedItem.title;
    let url = '';
    if (isGroup) {
      url = meetingDisplayLink(suggestedItem as Meeting);
    } else {
      const bt = suggestedItem as unknown as BookingType;
      url =
        bt.short_url ||
        bt.public_url ||
        `https://vito.rasppi.cloud/book/${username}/${bt.slug}`;
    }

    try {
      const msg = isGroup
        ? buildMeetingShareMessage(suggestedItem as any, url)
        : `Olá! Segue o link para agendar nossa conversa (${title}):\n${url}`;

      const waUrl = `whatsapp://send?text=${encodeURIComponent(msg)}`;
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Share.share({ message: msg, url, title });
      }
    } catch {}
  };

  const handleCopy = (url: string) => {
    setCopiedUrl(url);
    onCopyLink(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  if (totalCount === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ink}
          />
        }
      >
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surf }]}>
          <MaterialIcons name="link-off" size={32} color={colors.muted} />
        </View>
        <Text
          style={[
            styles.emptyTitle,
            {
              color: colors.ink,
              fontFamily: tokens.typography.family.montserratBold,
            },
          ]}
        >
          Nenhum link configurado
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
          Crie links com janelas de atendimento individuais ou enquetes em grupo com votação de horários.
        </Text>
        <TouchableOpacity
          style={[styles.emptyActionButton, { backgroundColor: colors.ink }]}
          onPress={onCreateNew}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color={colors.bg} />
          <Text
            style={[
              styles.emptyActionText,
              { color: colors.bg, fontFamily: tokens.typography.family.semibold },
            ]}
          >
            Criar Primeiro Link
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.ink}
        />
      }
    >
      {/* Sugestão Inteligente do Vito .vsug */}
      {showVitoSuggestion && suggestedItem && (
        <View
          style={[
            styles.vsug,
            {
              backgroundColor: colors.bg,
              borderColor: colors.line,
            },
          ]}
        >
          <View style={styles.vsugIcon}>
            <VitoMascot size={28} animated={true} />
          </View>
          <View style={styles.vsugContent}>
            <Text style={[styles.vsugText, { color: colors.ink }]}>
              Quer que eu envie o link da {suggestedItem.title} pelo WhatsApp?
            </Text>
            <View style={styles.vsugButtons}>
              <TouchableOpacity
                style={[styles.vsugBtnPrimary, { backgroundColor: colors.ink }]}
                onPress={handleSendViaWhatsApp}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.vsugBtnTextPrimary,
                    { color: colors.bg, fontFamily: tokens.typography.family.semibold },
                  ]}
                >
                  Enviar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.vsugBtnGhost, { borderColor: colors.ink }]}
                onPress={() => setShowVitoSuggestion(false)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.vsugBtnTextGhost,
                    { color: colors.ink, fontFamily: tokens.typography.family.semibold },
                  ]}
                >
                  Agora não
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Cards de Reuniões em Grupo */}
      {meetings.map((m) => (
        <VitoBookingCard
          key={`m_${m.id}`}
          item={{ kind: 'group', data: m }}
          isCopied={copiedUrl === meetingDisplayLink(m as any)}
          username={username}
          onCopyLink={handleCopy}
          onEdit={(item) => onEditMeeting(item as Meeting)}
          onDuplicate={onDuplicateMeeting ? (item) => onDuplicateMeeting(item as Meeting) : undefined}
          onDelete={(id) => onDeleteMeeting(id)}
          onOpenVotingDetail={onOpenVotingDetail}
        />
      ))}

      {/* Cards de Links 1-on-1 */}
      {types.map((bt) => (
        <VitoBookingCard
          key={`bt_${bt.id}`}
          item={{ kind: 'individual', data: bt }}
          isCopied={
            copiedUrl ===
            (bt.short_url ||
              bt.public_url ||
              `https://vito.rasppi.cloud/book/${username}/${bt.slug}`)
          }
          username={username}
          onCopyLink={handleCopy}
          onEdit={(item) => onEditType(item as BookingType)}
          onDuplicate={onDuplicateType ? (item) => onDuplicateType(item as BookingType) : undefined}
          onDelete={(id) => onDeleteType(id)}
          onToggleActive={onToggleActiveType}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: tokens.typography.family.regular,
    marginBottom: 20,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionText: {
    fontSize: 14,
  },
  vsug: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: 'rgba(20,25,22,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  vsugIcon: {
    width: 30,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugContent: {
    flex: 1,
  },
  vsugText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: tokens.typography.family.regular,
  },
  vsugButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vsugBtnPrimary: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBtnTextPrimary: {
    fontSize: 13,
  },
  vsugBtnGhost: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBtnTextGhost: {
    fontSize: 13,
  },
});
