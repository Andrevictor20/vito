import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatQuotaBanner } from '../components/chat/ChatQuotaBanner';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { useAuth } from '../context/AuthContext';

interface ChatScreenProps {
  onDataChanged?: () => void;
  onPressProfile?: () => void;
  onKeyboardStateChange?: (isOpen: boolean) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  onDataChanged,
  onPressProfile,
  onKeyboardStateChange,
}) => {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const { messages, loading, sendMessage, clearHistory } = useChat(onDataChanged);
  const [inputText, setInputText] = useState('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Monitoramento ativo de eventos do teclado para auto-scroll e recolhimento da navegação
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (_e: KeyboardEvent) => {
      setIsKeyboardOpen(true);
      if (onKeyboardStateChange) onKeyboardStateChange(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };

    const onHide = () => {
      setIsKeyboardOpen(false);
      if (onKeyboardStateChange) onKeyboardStateChange(false);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [onKeyboardStateChange]);

  // Rola para a última mensagem ao carregar novas mensagens
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, [messages.length, loading]);

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

  const handleToggleRecording = () => {
    if (loading) return;
    if (!isRecording) {
      setIsRecording(true);
    } else {
      setIsRecording(false);
      setInputText('Organizar minha sexta-feira e agendar alinhamento de produto às 14h');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
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
          accessibilityLabel="Limpar histórico do chat"
        >
          <MaterialIcons name="cleaning-services" size={14} color={tokens.colors.textSecondary} />
          <Text style={styles.clearBtnText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      {/* Banner de Cota Semanal Estilo Toki/Stitch */}
      <ChatQuotaBanner quotaPercentage={18.5} daysRemaining={4} />

      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        style={styles.flatList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessageBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: isKeyboardOpen ? tokens.spacing.sm : 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={tokens.colors.primary} />
              <Text style={styles.loadingText}>Vito está organizando...</Text>
            </View>
          ) : null
        }
      />

      {/* Chips Rápidos de Sugestões Executivas */}
      {!isKeyboardOpen && (
        <ChatQuickChips onSelectPrompt={handleQuickPrompt} disabled={loading} />
      )}

      {/* Dock Flutuante de Digitação com Cápsula Arredondada */}
      <View style={[
        styles.dockContainer,
        {
          paddingBottom: isKeyboardOpen
            ? (Platform.OS === 'android' ? 8 : 4)
            : 58,
        },
      ]}>
        <ChatInputDock
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          loading={loading}
          isRecording={isRecording}
          onPressMic={handleToggleRecording}
        />
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
    paddingHorizontal: tokens.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 44 : tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
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
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.size.xs + 1,
    fontWeight: tokens.typography.weight.bold,
  },
  metaUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
  },
  aiDot: {
    width: 5,
    height: 5,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
  },
  aiBadgeText: {
    fontSize: 10,
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
    letterSpacing: 0.5,
  },
  metaSyncText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainerLow,
  },
  clearBtnText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  messagesList: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceContainerLow,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.lg,
    borderTopLeftRadius: 4,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.sm,
  },
  dockContainer: {
    backgroundColor: 'transparent',
  },
  flatList: {
    flex: 1,
  },
});
