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
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  ImagePicker = null;
}
import { tokens, MD3Shapes } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatQuotaBanner } from '../components/chat/ChatQuotaBanner';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { ConversationHistoryModal } from '../components/chat/ConversationHistoryModal';
import { VitoMascot } from '../components/common/VitoMascot';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { colors, isDark, toggleTheme } = useTheme();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const {
    messages,
    loading,
    sessions,
    sendMessage,
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
  } = useChat(onDataChanged);
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
    if (!ImagePicker) {
      alert('Módulo de fotos não disponível nesta versão.');
      return;
    }

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
        Alert.alert('Gravação de Áudio', 'O módulo de gravação de áudio nativo não está disponível neste ambiente.');
        return;
      }
      const granted = await SafeAudioRecorder.requestPermissions();
      if (!granted) {
        Alert.alert('Microfone Necessário', 'Por favor, conceda permissão de microfone para enviar mensagens de voz ao Vito.');
        return;
      }
      const started = await SafeAudioRecorder.startRecording();
      if (started) {
        setIsRecording(true);
      } else {
        Alert.alert('Gravação', 'Não foi possível iniciar a gravação de áudio no momento.');
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
      style={[styles.container, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
    >
      {/* Top App Bar Minimalista & Despoluída estilo ChatGPT/Linear */}
      <View style={[styles.topAppBar, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.topAppBarLeft}>
          <View style={styles.brandRow}>
            <VitoMascot
              size={30}
              state={loading ? 'thinking' : 'idle'}
            />
            <Text style={[styles.chatBrand, { color: colors.onSurface }]}>vito</Text>
            <View style={[styles.statusDot, { backgroundColor: colors.statusOnline }]} />
          </View>
          <Text style={[styles.chatSubtitle, { color: colors.textMuted }]}>assistente ia</Text>
        </View>

        <View style={styles.topAppBarRight}>
          <TouchableOpacity
            style={[styles.iconActionButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
            onPress={() => setHistoryVisible(true)}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Histórico de conversas"
          >
            <MaterialIcons name="forum" size={18} color={colors.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconActionButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={18}
              color={colors.onSurface}
            />
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={[styles.userAvatar, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
              onPress={onPressProfile}
              activeOpacity={0.75}
              accessibilityLabel="Perfil e Configurações"
              hitSlop={tokens.hitSlop.sm}
            >
              <Text style={[styles.avatarText, { color: colors.onSurface }]}>{firstName.charAt(0).toUpperCase()}</Text>
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
            <View style={[styles.loadingBubble, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Vito está organizando...</Text>
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
            marginBottom: keyboardHeight + 14,
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
        onNewChat={startNewConversation}
        conversations={sessions}
        onSelectConversation={switchConversation}
        onDeleteConversation={deleteConversation}
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
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBrand: {
    fontSize: 18,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: -0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chatSubtitle: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.medium,
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
    paddingBottom: Platform.OS === 'android' ? 8 : 8,
  },
});
