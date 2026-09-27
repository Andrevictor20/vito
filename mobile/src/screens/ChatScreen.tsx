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
      {/* Top Header do Chat */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerBrand}>vito</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearHistory}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
          >
            <Text style={styles.clearButtonText}>Limpar</Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={styles.userAvatar}
              onPress={onPressProfile}
              activeOpacity={0.7}
              accessibilityLabel="Perfil e Configurações"
              hitSlop={tokens.hitSlop.sm}
            >
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
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
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.surface,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  headerBrand: {
    fontSize: tokens.typography.size.xxl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.textPrimary,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: tokens.colors.primaryLight,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  badgeText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.size.xs - 1,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  clearButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  clearButtonText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: tokens.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
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
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  promptChipText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
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
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? tokens.spacing.sm : tokens.spacing.xs,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceSubtle,
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
  },
});
