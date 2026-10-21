import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
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
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { ChatHistoryDrawer } from '../components/chat/ChatHistoryDrawer';
import { ChatEmptyWelcome } from '../components/chat/ChatEmptyWelcome';
import { FocusMenuModal } from '../components/chat/FocusMenuModal';
import { FocusMode } from '../types/focus';
import { prepareEditDraft } from '../utils/chatActions';
import { pickWelcomeGreeting } from '../utils/chatGreetings';
import { resolveKeyboardHeight } from '../utils/keyboardHeight';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SafeAudioRecorder } from '../services/audioRecorder';

export interface ChatScreenProps {
  onDataChanged?: () => void;
  onKeyboardStateChange?: (isOpen: boolean) => void;
  onLoadingStateChange?: (loading: boolean) => void;
}

export interface ChatScreenRef {
  openHistory: () => void;
  startNewChat: () => void;
  submitExternalPrompt: (text: string) => void;
}

export const ChatScreen = forwardRef<ChatScreenRef, ChatScreenProps>(({
  onDataChanged,
  onKeyboardStateChange,
  onLoadingStateChange,
}, ref) => {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const {
    messages,
    loading,
    sessions,
    sendMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
  } = useChat(onDataChanged, user?.id);

  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  // Mime real da imagem escolhida: enviar "image/jpeg" para um PNG/WEBP/HEIC
  // fazia o backend receber um tipo incompatível com os bytes da imagem.
  const [selectedImageMime, setSelectedImageMime] = useState<string | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<FocusMode | null>(null);
  const [focusModalVisible, setFocusModalVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  // Espelhos p/ o listener de teclado decidir sem re-subscrever (zona morta).
  const keyboardOpenRef = useRef(false);
  const keyboardHeightRef = useRef(0);

  // Boas-vindas sorteadas por período do dia, uma por montagem da tela
  // (cada abertura do app). Estável durante a sessão via useMemo.
  const welcomeGreeting = React.useMemo(
    () => pickWelcomeGreeting(firstName, new Date().getHours()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useImperativeHandle(ref, () => ({
    openHistory: () => setHistoryVisible(true),
    startNewChat: () => {
      setInputText('');
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setSelectedFocus(null);
      startNewConversation();
    },
    submitExternalPrompt: (text: string) => {
      if (text.trim()) {
        sendMessage(text.trim(), selectedFocus?.id);
      }
    },
  }), [startNewConversation, sendMessage, selectedFocus?.id]);


  useEffect(() => {
    onLoadingStateChange?.(loading);
  }, [loading, onLoadingStateChange]);

  // Monitoramento ativo de eventos do teclado para auto-scroll e elevação precisa
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height || 0;
      // Zona morta: ignora re-disparos com variação pequena (faixa de
      // sugestões do Gboard) — cada setState move o dock e cancela o toque
      // em voo, o que causava o "1º toque só fecha o teclado".
      const resolved = resolveKeyboardHeight(keyboardHeightRef.current, keyboardOpenRef.current, h);
      if (resolved === null) return;
      keyboardHeightRef.current = resolved;
      keyboardOpenRef.current = true;
      setKeyboardHeight(resolved);
      setIsKeyboardOpen(true);
      if (onKeyboardStateChange) onKeyboardStateChange(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    };

    const onHide = () => {
      keyboardHeightRef.current = 0;
      keyboardOpenRef.current = false;
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

  const openImagePicker = async (useCamera: boolean = false) => {
    if (loading) return;
    if (!ImagePicker) {
      Alert.alert('Fotos', 'Módulo de fotos não disponível nesta versão.');
      return;
    }

    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissão da Câmera', 'É necessário conceder permissão de câmera para tirar foto de convites e recibos.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setSelectedImageUri(result.assets[0].uri);
          setSelectedImageBase64(result.assets[0].base64 || null);
          setSelectedImageMime(result.assets[0].mimeType || null);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissão de Fotos', 'É necessário conceder permissão de galeria para anexar imagens.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setSelectedImageUri(result.assets[0].uri);
          setSelectedImageBase64(result.assets[0].base64 || null);
          setSelectedImageMime(result.assets[0].mimeType || null);
        }
      }
    } catch (e) {
      console.error('Falha ao selecionar imagem:', e);
      Alert.alert('Erro', 'Não foi possível carregar a imagem.');
    }
  };

  const handlePickImage = () => {
    if (loading) return;
    Alert.alert(
      'Anexar Imagem',
      'Como deseja enviar a foto ou documento para o Vito?',
      [
        {
          text: 'Tirar Foto',
          onPress: () => openImagePicker(true),
        },
        {
          text: 'Escolher da Galeria',
          onPress: () => openImagePicker(false),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const handleSend = () => {
    if ((!inputText.trim() && !selectedImageUri) || loading) return;

    if (selectedImageUri) {
      const uri = selectedImageUri;
      const b64 = selectedImageBase64 || undefined;
      const mime = selectedImageMime || undefined;
      const prompt = inputText.trim() || undefined;
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setSelectedImageMime(null);
      setInputText('');
      sendImage(uri, prompt, b64, mime);
    } else {
      const text = inputText;
      setInputText('');
      sendMessage(text, selectedFocus?.id);
    }
    // Mantém teclado aberto e foco para a próxima mensagem (1 toque sempre).
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return;
    sendMessage(prompt, selectedFocus?.id);
  };

  const handleEditMessage = (text: string) => {
    setInputText(prepareEditDraft(inputText, text));
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSelectSlot = (slot: import('../types').TimeSlot, msg: import('../types').ChatMessage) => {
    if (loading) return;
    const title = msg.event?.title || msg.conflict?.conflicting_title;
    if (title) {
      sendMessage(`Reagendar "${title}" para ${slot.label}`, selectedFocus?.id);
    } else {
      sendMessage(`Reagendar compromisso para ${slot.label}`, selectedFocus?.id);
    }
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
        await sendAudio(result.uri, selectedFocus?.id);
      } else {
        console.warn('[Voice] Nenhum URI de áudio retornado.');
      }
    }
  };


  const handleCancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      await SafeAudioRecorder.stopRecording();
    } catch (e) {
      // ignore
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
    >
      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        style={styles.flatList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatMessageBubble
            message={item}
            onSelectSlot={handleSelectSlot}
            onEditMessage={handleEditMessage}
            onSaveEdit={(messageId, newText) => editAndResendMessage(messageId, newText)}
            onConfirmAction={handleQuickPrompt}
            disabled={loading}
          />
        )}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.emptyMessagesList,
          { paddingBottom: isKeyboardOpen ? 28 : 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ChatEmptyWelcome welcomeGreeting={welcomeGreeting} loading={loading} />
        }
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
          {
            paddingBottom: isKeyboardOpen
              ? 28
              : Platform.OS === 'ios'
              ? 102
              : 104,
          },
        ]}
      >
        <ChatInputDock
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          loading={loading}
          onStop={stopGeneration}
          inputRef={inputRef}
          isRecording={isRecording}
          onPressMic={handleToggleRecording}
          onCancelRecording={handleCancelRecording}
          onPressAttach={handlePickImage}
          selectedImageUri={selectedImageUri}
          onClearImage={() => {
            setSelectedImageUri(null);
            setSelectedImageBase64(null);
          }}
          selectedFocus={selectedFocus}
          onPressFocus={() => setFocusModalVisible(true)}
          onClearFocus={() => setSelectedFocus(null)}
        />
      </View>
      <ChatHistoryDrawer
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onNewChat={startNewConversation}
        conversations={sessions}
        onSelectConversation={switchConversation}
        onDeleteConversation={deleteConversation}
      />
      <FocusMenuModal
        visible={focusModalVisible}
        onClose={() => setFocusModalVisible(false)}
        selectedFocus={selectedFocus}
        onSelectFocus={setSelectedFocus}
      />
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
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
  emptyMessagesList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  suggestionsWrapper: {
    paddingBottom: 4,
  },
  dockContainer: {
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'android' ? 8 : 8,
  },
});

