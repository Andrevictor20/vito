import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';

interface ConversationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
}

const mockConversations = [
  {
    id: '1',
    title: 'Churrasco de Aniversário',
    preview: 'Vamos revisar o checklist de bebidas e carnes?',
    time: 'Hoje',
    active: true,
  },
  {
    id: '2',
    title: 'Festa da Família',
    preview: 'Encontrei 3 ideias de temas e sugestões de pratos.',
    time: 'Ontem',
  },
  {
    id: '3',
    title: 'Jantar para 15 Convidados',
    preview: 'Cálculo de bebidas estimado em 18 litros.',
    time: '12 out',
  },
];

export const ConversationHistoryModal: React.FC<ConversationHistoryModalProps> = ({
  visible,
  onClose,
  onNewChat,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header M3 */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fechar histórico"
              hitSlop={tokens.hitSlop.sm}
            >
              <MaterialIcons name="arrow-back" size={24} color={tokens.colors.onSurface} />
            </TouchableOpacity>

            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Conversas</Text>
              <Text style={styles.headerSub}>Continue de onde parou</Text>
            </View>
          </View>

          {/* Lista de Conversas Recentes */}
          <ScrollView contentContainerStyle={styles.listContent}>
            {mockConversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={[styles.convCard, conv.active && styles.convCardActive]}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <View style={styles.convIcon}>
                  <MaterialIcons
                    name="chat-bubble-outline"
                    size={20}
                    color={tokens.colors.primary}
                  />
                </View>

                <View style={styles.convDetails}>
                  <View style={styles.convTitleRow}>
                    <Text style={styles.convTitle} numberOfLines={1}>
                      {conv.title}
                    </Text>
                    <Text style={styles.convTime}>{conv.time}</Text>
                  </View>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {conv.preview}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Botão Inferior: Nova Conversa */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.newChatBtn}
              onPress={() => {
                onClose();
                onNewChat();
              }}
              activeOpacity={0.85}
              accessibilityLabel="Iniciar nova conversa"
            >
              <MaterialIcons name="add" size={20} color={tokens.colors.onPrimary} />
              <Text style={styles.newChatBtnText}>Nova conversa</Text>
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
});
