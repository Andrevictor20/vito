import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { tokens } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { BookingType, Meeting } from '../../../../types';
import { VitoBookingCard } from './VitoBookingCard';
import { meetingDisplayLink } from '../../../chat/utils/chatCards';

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
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const totalCount = types.length + meetings.length;

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
          <ProtoUiIcon name="link-off" size={32} color={colors.muted} />
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
          <ProtoUiIcon name="add" size={20} color={colors.bg} />
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
