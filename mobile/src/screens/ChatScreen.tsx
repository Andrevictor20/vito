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
import { tokens, MD3Shapes } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatQuotaBanner } from '../components/chat/ChatQuotaBanner';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { useAuth } from '../context/AuthContext';
import { SafeAudioRecorder } from '../services/audioRecorder';

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
  const { messages, loading, sendMessage, sendAudio, clearHistory } = useChat(onDataChanged);
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

  const handleToggleRecording = async () => {
    if (loading) return;

    if (!isRecording) {
      // --- INICIAR GRAVAÇÃO ---
      if (!SafeAudioRecorder.isAudioSupported()) {
        // Fallback: Expo Go sem expo-audio nativo. Usa modo texto
        console.warn('[Voice] expo-audio não disponível neste runtime.');
        setIsRecording(true);
        return;
      }
      const granted = await SafeAudioRecorder.requestPermissions();
      if (!granted) {
        console.warn('[Voice] Permissão de microfone negada.');
        return;
      }
      const started = await SafeAudioRecorder.startRecording();
      if (started) {
        setIsRecording(true);
      }
    } else {
      // --- PARAR E ENVIAR ---
      setIsRecording(false);
      const result = await SafeAudioRecorder.stopRecording();
      if (result?.uri) {
        // Envia o áudio real para o backend (Groq Whisper)
        await sendAudio(result.uri);
      } else {
        console.warn('[Voice] Nenhum URI de áudio retornado.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

      {/* Dock de Digitação M3 */}
      <View style={styles.dockContainer}>
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
    backgroundColor: tokens.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 44 : tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
    backgroundColor: tokens.colors.surface,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    fontSize: tokens.typography.size.titleLarge,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.secondaryContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.onSecondaryContainer,
    fontSize: tokens.typography.size.labelMedium,
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
    borderRadius: MD3Shapes.small,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.primary,
  },
  aiBadgeText: {
    fontSize: 10,
    color: tokens.colors.onSecondaryContainer,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.5,
  },
  metaSyncText: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.onSurfaceVariant,
    fontWeight: tokens.typography.weight.medium,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  clearBtnText: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.onSurfaceVariant,
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
    backgroundColor: tokens.colors.surfaceContainer,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: MD3Shapes.large,
    borderBottomLeftRadius: MD3Shapes.extraSmall,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  loadingText: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.bodySmall,
  },
  dockContainer: {
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'android' ? 6 : 8,
  },
  flatList: {
    flex: 1,
  },
});
