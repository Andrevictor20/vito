import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { useAuth } from '../context/AuthContext';

const QUICK_PROMPTS = [
  'O que tenho na agenda hoje?',
  'Listar tarefas pendentes',
  'Agendar almoço amanhã às 12h',
  'Nova tarefa: Comprar café',
];

interface ChatScreenProps {
  onDataChanged?: () => void;
  onPressProfile?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onDataChanged, onPressProfile }) => {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const { messages, loading, sendMessage, clearHistory } = useChat(onDataChanged);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Rola para a última mensagem quando o histórico mudar
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, loading]);

  const handleSend = () => {
    if (!inputText.trim() || loading) return;
    const text = inputText;
    setInputText('');
    sendMessage(text);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return;
    sendMessage(prompt);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Top Header Stitch */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>vito</Text>
          <View style={styles.brandDot} />
        </View>

        {user && (
          <TouchableOpacity
            style={styles.userAvatar}
            onPress={onPressProfile}
            activeOpacity={0.75}
            accessibilityLabel="Perfil e Configurações"
            hitSlop={tokens.hitSlop.sm}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sub-header Meta Utility Bar */}
      <View style={styles.metaUtilityBar}>
        <View style={styles.metaLeft}>
          <View style={styles.aiBadge}>
            <View style={styles.aiDot} />
            <Text style={styles.aiBadgeText}>AI ASSISTANT</Text>
          </View>
          <Text style={styles.metaSyncText}>Sincronizado</Text>
        </View>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={clearHistory}
          activeOpacity={0.75}
          hitSlop={tokens.hitSlop.sm}
        >
          <Text style={styles.clearBtnText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessageBubble message={item} />}
        contentContainerStyle={styles.messagesList}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={tokens.colors.primary} />
              <Text style={styles.loadingText}>Vito está pensando...</Text>
            </View>
          ) : null
        }
      />

      {/* Chips de Ação Rápida */}
      <View style={styles.quickPromptsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsList}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => handleQuickPrompt(prompt)}
              activeOpacity={0.7}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Barra de Envio */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Digite ou instrua o Vito..."
          placeholderTextColor={tokens.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />

        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.bg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.4,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primaryContainer,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  metaUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.bg,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.secondaryContainer,
  },
  aiDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colors.primary,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primary,
    letterSpacing: 0.5,
  },
  metaSyncText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  clearBtnText: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
    fontWeight: '500',
  },
  messagesList: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.lg,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    marginLeft: 32,
  },
  loadingText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  quickPromptsWrapper: {
    paddingVertical: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.bg,
  },
  quickPromptsList: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  promptChip: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: tokens.radii.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  promptChipText: {
    fontSize: 12,
    color: tokens.colors.textSecondary,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.surfaceBorder,
    gap: tokens.spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? tokens.spacing.sm : tokens.spacing.xs + 2,
    color: tokens.colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceElevated,
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#00285d',
    fontSize: 18,
    fontWeight: '700',
  },
});
