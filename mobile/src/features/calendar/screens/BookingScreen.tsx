import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { hapticFeedback } from '../../../theme/motion';
import { chatPromptBus, tabNavigationBus } from '../../../services/dataSync';
import type { BookingType, Meeting } from '../../../types';
import { BookingLinksTab } from '../components/booking/BookingLinksTab';
import { BookingReceivedTab } from '../components/booking/BookingReceivedTab';
import { BookingStackHeader } from '../components/booking/BookingStackHeader';
import { BookingSegmentedControl, BookingTabKey } from '../components/booking/BookingSegmentedControl';
import { MeetingPollDetailView } from '../components/booking/MeetingPollDetailView';
import { SmartActionSheetModal } from '../../../components/ui/SmartActionSheetModal';
import { buildBookingSmartActions } from '../../../utils/formatting/smartActionBuilders';
import { bookingStyles as styles } from './BookingScreen.styles';
import { copyToClipboard } from '../../../utils/device/clipboard';
import { useBookingData } from '../hooks/useBookingData';

const extractBookingUsername = (types: BookingType[]): string => {
  for (const t of types || []) {
    const m = (t.public_url || '').match(/\/book\/([^/]+)\//);
    if (m) return m[1];
  }
  return 'seu-usuario';
};

interface BookingScreenProps {
  onBack?: () => void;
  createRequestId?: number;
  onSubViewChange?: (inSubView: boolean) => void;
  showBackHeader?: boolean;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({
  onBack,
  createRequestId,
  onSubViewChange,
  showBackHeader = false,
}) => {
  const { colors, isDark } = useTheme();
  const { user: authUser } = useAuth();
  const navigation = useNavigation();
  const firstCreateRender = React.useRef(true);

  const [activeTab, setActiveTab] = useState<BookingTabKey>('links');
  const [actionTarget, setActionTarget] = useState<{
    item: BookingType | Meeting;
    type: 'type' | 'meeting';
  } | null>(null);

  const {
    types,
    appointments,
    meetings,
    loading,
    refreshing,
    confirmingSlotId,
    selectedMeetingForDetail,
    setSelectedMeetingForDetail,
    onRefresh,
    handleToggleActive,
    handleDeleteType,
    handleDeleteMeeting,
    handleCancelAppointment,
    handleConfirmMeetingSlot,
  } = useBookingData();

  const navigateToChat = useCallback(
    (prompt?: string) => {
      if (prompt) {
        chatPromptBus.askAssistant(prompt);
      } else {
        tabNavigationBus.notify('chat');
      }
      if (onBack) {
        onBack();
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    [navigation, onBack],
  );

  const handleBookingPrompt = useCallback(() => {
    navigateToChat('Quero criar um novo link de agendamento. Me ajude a definir título, duração e horários.');
  }, [navigateToChat]);

  useEffect(() => {
    if (firstCreateRender.current) {
      firstCreateRender.current = false;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      handleBookingPrompt();
    }
  }, [createRequestId, handleBookingPrompt]);

  useEffect(() => {
    onSubViewChange?.(Boolean(selectedMeetingForDetail));
  }, [selectedMeetingForDetail, onSubViewChange]);

  const bookingUsername = useMemo(() => {
    const fromTypes = extractBookingUsername(types);
    if (fromTypes !== 'seu-usuario') return fromTypes;
    if (authUser?.name) {
      const fromName = authUser.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fromName) return fromName;
    }
    return 'usuario';
  }, [types, authUser]);

  const handleCopyLink = useCallback(async (url: string) => {
    hapticFeedback.medium();
    await copyToClipboard(url);
  }, []);

  const renderActionSheet = () => (
    <SmartActionSheetModal
      visible={!!actionTarget}
      onClose={() => setActionTarget(null)}
      tag={actionTarget?.type === 'type' ? 'LINK DE AGENDAMENTO' : 'VOTAÇÃO DE REUNIÃO'}
      title={actionTarget?.item.title || ''}
      subtitle={
        actionTarget?.type === 'type'
          ? `${(actionTarget.item as BookingType).duration_minutes || 30} min • Link individual`
          : 'Reunião com votação em grupo'
      }
      actions={
        actionTarget
          ? buildBookingSmartActions(
              {
                id: actionTarget.item.id,
                title: actionTarget.item.title,
                slug: (actionTarget.item as BookingType).slug,
                duration: (actionTarget.item as BookingType).duration_minutes,
              },
              actionTarget.type,
              {
                onCopyLink: () => {
                  if (actionTarget.type === 'type') {
                    const bt = actionTarget.item as BookingType;
                    const url =
                      bt.short_url ||
                      bt.public_url ||
                      `https://vito.rasppi.cloud/book/${bookingUsername}/${bt.slug}`;
                    void handleCopyLink(url);
                  } else {
                    const m = actionTarget.item as Meeting & { public_url?: string; short_url?: string };
                    const url = m.public_url || m.short_url || `https://vito.rasppi.cloud/meet/${m.id}`;
                    void handleCopyLink(url);
                  }
                },
                onAskVitoCustomize: (prompt) => navigateToChat(prompt),
                onAskVitoDuplicate: (prompt) => navigateToChat(prompt),
                onDelete: () => {
                  if (actionTarget.type === 'type') {
                    handleDeleteType(actionTarget.item.id);
                  } else {
                    handleDeleteMeeting(actionTarget.item.id);
                  }
                },
              },
            )
          : []
      }
    />
  );

  if (selectedMeetingForDetail) {
    return (
      <View style={{ flex: 1 }}>
        <MeetingPollDetailView
          meeting={selectedMeetingForDetail}
          onBack={() => setSelectedMeetingForDetail(null)}
          onEdit={(target) => setActionTarget({ item: target, type: 'meeting' })}
          onConfirmSlot={handleConfirmMeetingSlot}
          confirmingSlotId={confirmingSlotId}
          onDelete={async (id) => {
            setSelectedMeetingForDetail(null);
            handleDeleteMeeting(id);
          }}
        />
        {renderActionSheet()}
      </View>
    );
  }

  const linksCount = types.length + meetings.length;
  const receivedCount = appointments.length + meetings.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {showBackHeader && (
        <BookingStackHeader
          onBack={() => (onBack ? onBack() : navigation.goBack())}
          onPressNew={handleBookingPrompt}
        />
      )}

      <BookingSegmentedControl
        activeTab={activeTab}
        linksCount={linksCount}
        receivedCount={receivedCount}
        onSelectTab={setActiveTab}
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      ) : activeTab === 'links' ? (
        <BookingLinksTab
          types={types}
          meetings={meetings}
          username={bookingUsername}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onCopyLink={handleCopyLink}
          onEditType={(bt) => setActionTarget({ item: bt, type: 'type' })}
          onEditMeeting={(m) => setActionTarget({ item: m, type: 'meeting' })}
          onDeleteType={handleDeleteType}
          onDeleteMeeting={handleDeleteMeeting}
          onOpenVotingDetail={(m) => setSelectedMeetingForDetail(m)}
          onToggleActiveType={handleToggleActive}
          onCreateNew={handleBookingPrompt}
        />
      ) : (
        <BookingReceivedTab
          appointments={appointments}
          meetings={meetings}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onOpenVotingDetail={(m) => setSelectedMeetingForDetail(m)}
          onCancelAppointment={handleCancelAppointment}
        />
      )}

      {renderActionSheet()}
    </View>
  );
};
