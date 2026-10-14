import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { ConversationSession } from '../../types';
import { humanizePreview } from '../../utils/chatPreview';
import { formatGroupTimestamp, groupSessionsByDate } from '../../utils/chatHistoryGrouping';
import { useTheme } from '../../context/ThemeContext';

interface ChatHistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: ConversationSession[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  pendingCount?: number;
  onRetrySync?: () => void;
}

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.84, 340);

/** Gaveta lateral de histórico do chat (100% JS, sem lib de drawer nativa). */
export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  visible,
  onClose,
  onNewChat,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  pendingCount,
  onRetrySync,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const groups = groupSessionsByDate(conversations);
  const showPending = (pendingCount ?? 0) > 0;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : -PANEL_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.panel,
            { width: PANEL_WIDTH, backgroundColor: colors.surface, transform: [{ translateX: slide }] },
          ]}
        >
          <SafeAreaView
            style={[
              styles.safeArea,
              {
                backgroundColor: colors.surface,
                paddingTop: Platform.OS === 'android' ? Math.max((RNStatusBar.currentHeight || 0) + 6, 12) : 0,
              },
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerLow }]}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Fechar histórico"
                hitSlop={tokens.hitSlop.md}
              >
                <MaterialIcons name="menu" size={22} color={colors.onSurface} />
              </TouchableOpacity>

              <View style={styles.headerTextCol}>
                <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Conversas</Text>
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                  Continue de onde parou ({conversations.length})
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {showPending && (
                <View
                  style={[styles.pendingCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                  accessibilityRole="alert"
                  accessibilityLabel={`Sincronização pendente, ${pendingCount} conversas`}
                >
                  <MaterialIcons name="sync-problem" size={20} color={colors.onSurface} />
                  <Text style={[styles.pendingText, { color: colors.onSurface }]}>
                    Sincronização pendente ({pendingCount})
                  </Text>
                  {onRetrySync && (
                    <TouchableOpacity
                      style={[styles.retryBtn, { backgroundColor: colors.surfaceContainerHighest }]}
                      onPress={onRetrySync}
                      activeOpacity={0.75}
                      accessibilityLabel="Reenviar sincronização pendente"
                      accessibilityRole="button"
                      hitSlop={tokens.hitSlop.md}
                    >
                      <MaterialIcons name="refresh" size={18} color={colors.onSurface} />
                      <Text style={[styles.retryText, { color: colors.onSurface }]}>Reenviar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {conversations.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainer }]}>
                    <MaterialIcons name="chat" size={32} color={colors.outline} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                    Nenhuma conversa encontrada
                  </Text>
                  <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                    Suas trocas de mensagens com o Vito aparecerão listadas aqui para você retomar quando quiser.
                  </Text>
                </View>
              ) : (
                groups.map((group) => (
                  <View key={group.key}>
                    <Text
                      style={[styles.groupHeader, { color: colors.textMuted }]}
                      accessibilityRole="header"
                    >
                      {group.title}
                    </Text>
                    {group.sessions.map((conv) => {
                      const isActive = !!conv.active;
                      return (
                        <TouchableOpacity
                          key={conv.id}
                          style={[
                            styles.convCard,
                            {
                              backgroundColor: isActive
                                ? colors.surfaceContainerHighest
                                : colors.surfaceContainerLow,
                              borderColor: isActive ? colors.primary : colors.outlineVariant,
                            },
                          ]}
                          onPress={() => {
                            onSelectConversation(conv.id);
                            onClose();
                          }}
                          activeOpacity={0.75}
                          accessibilityLabel={`Abrir conversa ${conv.title || 'Conversa'}`}
                          hitSlop={tokens.hitSlop.sm}
                        >
                          <View
                            style={[
                              styles.convIcon,
                              {
                                backgroundColor: isActive ? colors.primary : colors.surfaceContainerHighest,
                              },
                            ]}
                          >
                            <MaterialIcons
                              name="chat-bubble-outline"
                              size={18}
                              color={isActive ? colors.onPrimary : colors.textPrimary}
                            />
                          </View>

                          <View style={styles.convDetails}>
                            <View style={styles.convTitleRow}>
                              <Text
                                style={[
                                  styles.convTitle,
                                  {
                                    color: colors.onSurface,
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {conv.title || 'Conversa'}
                              </Text>
                              <Text style={[styles.convTime, { color: colors.textMuted }]}>
                                {formatGroupTimestamp(conv.timestamp)}
                              </Text>
                            </View>
                            <Text
                              style={[styles.convPreview, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {humanizePreview(conv.preview)}
                            </Text>
                          </View>

                          {onDeleteConversation && conversations.length > 1 && (
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => onDeleteConversation(conv.id)}
                              hitSlop={tokens.hitSlop.md}
                              accessibilityLabel="Excluir conversa"
                              accessibilityRole="button"
                            >
                              <MaterialIcons name="delete-outline" size={18} color={colors.outline} />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.outlineVariant, paddingBottom: Math.max(insets.bottom, 0) + tokens.spacing.md }]}>
              <TouchableOpacity
                style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  onClose();
                  onNewChat();
                }}
                activeOpacity={0.85}
                accessibilityLabel="Iniciar nova conversa"
                accessibilityRole="button"
                hitSlop={tokens.hitSlop.sm}
              >
                <MaterialIcons name="add" size={20} color={colors.onPrimary} />
                <Text style={[styles.newChatBtnText, { color: colors.onPrimary }]}>
                  Nova conversa
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>

        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Fechar histórico"
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    height: '100%',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    elevation: 8,
  },
  safeArea: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: tokens.typography.size.titleLarge,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
  },
  headerSub: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.textMuted,
  },
  listContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    marginBottom: tokens.spacing.sm,
    minHeight: 48,
  },
  pendingText: {
    flex: 1,
    fontSize: tokens.typography.size.bodyMedium,
    fontWeight: tokens.typography.weight.semibold,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderRadius: MD3Shapes.full,
  },
  retryText: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: tokens.typography.weight.bold,
  },
  groupHeader: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    backgroundColor: tokens.colors.surfaceContainerLow,
    minHeight: 48,
    marginBottom: tokens.spacing.sm,
  },
  convIcon: {
    width: 40,
    height: 40,
    borderRadius: MD3Shapes.medium,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convDetails: {
    flex: 1,
  },
  convTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    flex: 1,
    marginRight: tokens.spacing.xs,
  },
  convTime: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },
  convPreview: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: tokens.spacing.md,
    // Folga da barra de gestos do Android (o botão invadia a gesture bar).
    paddingBottom: Platform.OS === 'android' ? tokens.spacing.md + 12 : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outlineVariant,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary,
    borderRadius: MD3Shapes.full,
    paddingVertical: 14,
    minHeight: 48,
    ...tokens.shadows.level2,
  },
  newChatBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: tokens.typography.weight.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
