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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Monitoramento ativo de eventos do teclado para auto-scroll e elevação precisa
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height || 0;
      setKeyboardHeight(h);
      setIsKeyboardOpen(true);
      if (onKeyboardStateChange) onKeyboardStateChange(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    };

    const onHide = () => {
      setKeyboardHeight(0);
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
      {/* Top App Bar M3 Unificada */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>vito</Text>
            <View style={styles.brandDot} />
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>AI Assistant</Text>
          </View>
        </View>

        <View style={styles.topAppBarRight}>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={clearHistory}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Limpar histórico do chat"
          >
            <MaterialIcons name="delete-outline" size={18} color={tokens.colors.onSurfaceVariant} />
          </TouchableOpacity>

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
      </View>

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

      {/* Chips Rápidos de Sugestões Executivas (Início do Chat) */}
      {messages.length <= 2 && !isKeyboardOpen && (
        <View style={styles.suggestionsWrapper}>
          <ChatQuickChips onSelectPrompt={handleQuickPrompt} disabled={loading} />
        </View>
      )}

      {/* Dock de Digitação M3 com Elevação Dinâmica de Teclado */}
      <View
        style={[
          styles.dockContainer,
          Platform.OS === 'android' && keyboardHeight > 0 && {
            marginBottom: keyboardHeight,
          },
        ]}
      >
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
  // M3 Top App Bar: 56dp altura, alinhamento canônico, borda outlineVariant sutil
  topAppBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
    backgroundColor: tokens.colors.surface,
  },
  topAppBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.tertiary,
  },
  statusBadgeText: {
    fontSize: 10,
    color: tokens.colors.onSurfaceVariant,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.3,
  },
  topAppBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.primaryContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.onPrimaryContainer,
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  flatList: {
    flex: 1,
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
  suggestionsWrapper: {
    paddingBottom: 4,
  },
  dockContainer: {
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'android' ? 6 : 8,
  },
});
