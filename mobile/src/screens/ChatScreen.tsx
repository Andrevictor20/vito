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
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatQuotaBanner } from '../components/chat/ChatQuotaBanner';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { ConversationHistoryModal } from '../components/chat/ConversationHistoryModal';
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
  const { messages, loading, sendMessage, sendAudio, sendImage, clearHistory } = useChat(onDataChanged);
  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
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

  const handlePickImage = async () => {
    if (loading) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('É necessário conceder permissão de fotos para anexar recibos ou imagens.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Falha ao selecionar imagem:', e);
    }
  };

  const handleSend = () => {
    if ((!inputText.trim() && !selectedImageUri) || loading) return;

    if (selectedImageUri) {
      const uri = selectedImageUri;
      const prompt = inputText.trim() || undefined;
      setSelectedImageUri(null);
      setInputText('');
      sendImage(uri, prompt);
    } else {
      const text = inputText;
      setInputText('');
      sendMessage(text);
    }
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
      {/* Top App Bar M3 com Ícone do Assistente e Ações */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <View style={styles.assistantIconBox}>
            <MaterialIcons name="auto-awesome" size={20} color={tokens.colors.primary} />
          </View>
          <View style={styles.titleColumn}>
            <Text style={styles.chatTitle}>Vito Assistant</Text>
            <Text style={styles.chatSubtitle}>Suas conversas e planos</Text>
          </View>
        </View>

        <View style={styles.topAppBarRight}>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={() => setHistoryVisible(true)}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Histórico de conversas"
          >
            <MaterialIcons name="menu" size={22} color={tokens.colors.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={clearHistory}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Limpar histórico do chat"
          >
            <MaterialIcons name="delete-outline" size={20} color={tokens.colors.onSurfaceVariant} />
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
          onPressAttach={handlePickImage}
          selectedImageUri={selectedImageUri}
          onClearImage={() => setSelectedImageUri(null)}
        />
      </View>
      <ConversationHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onNewChat={clearHistory}
      />
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
    gap: tokens.spacing.sm + 2,
  },
  assistantIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flexDirection: 'column',
    gap: 2,
  },
  chatTitle: {
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
  },
  chatSubtitle: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    fontWeight: tokens.typography.weight.medium,
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
