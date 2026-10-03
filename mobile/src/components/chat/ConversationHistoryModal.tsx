import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { ConversationSession } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface ConversationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: ConversationSession[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch {
    return 'Recente';
  }
}

export const ConversationHistoryModal: React.FC<ConversationHistoryModalProps> = ({
  visible,
  onClose,
  onNewChat,
  conversations,
  onSelectConversation,
  onDeleteConversation,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header M3 */}
          <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fechar histórico"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>

            <View style={styles.headerTextCol}>
              <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Conversas</Text>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                Continue de onde parou ({conversations.length})
              </Text>
            </View>
          </View>

          {/* Lista de Conversas Reais */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
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
              conversations.map((conv) => {
                const isActive = !!conv.active;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.convCard,
                      {
                        backgroundColor: isActive
                          ? isDark
                            ? colors.surfaceContainerHighest
                            : '#F4F4F5'
                          : colors.surfaceContainerLow,
                        borderColor: isActive ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                    onPress={() => {
                      onSelectConversation(conv.id);
                      onClose();
                    }}
                    activeOpacity={0.75}
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
                              fontWeight: isActive ? '700' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {conv.title || 'Conversa'}
                        </Text>
                        <Text style={[styles.convTime, { color: colors.textMuted }]}>
                          {formatRelativeTime(conv.timestamp)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.convPreview, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {conv.preview || 'Sem mensagens'}
                      </Text>
                    </View>

                    {onDeleteConversation && conversations.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => onDeleteConversation(conv.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Excluir conversa"
                      >
                        <MaterialIcons name="delete-outline" size={18} color={colors.outline} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Botão Inferior: Nova Conversa */}
          <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
            <TouchableOpacity
              style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                onClose();
                onNewChat();
              }}
              activeOpacity={0.85}
              accessibilityLabel="Iniciar nova conversa"
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimary} />
              <Text style={[styles.newChatBtnText, { color: colors.onPrimary }]}>
                Nova conversa
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingTop: Platform.OS === 'android' ? Math.max((RNStatusBar.currentHeight || 0) + 6, 44) : 0,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
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
  backBtn: {
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
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.large,
    backgroundColor: tokens.colors.surfaceContainerLow,
  },
  convCardActive: {
    backgroundColor: tokens.colors.surfaceContainer,
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
    fontSize: tokens.typography.size.bodyMedium,
    fontWeight: tokens.typography.weight.bold,
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
    padding: 6,
    marginLeft: 4,
  },
});
