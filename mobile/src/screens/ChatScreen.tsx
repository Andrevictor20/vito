import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
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
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { VitoVoiceOverlay } from '../overlay/VitoVoiceOverlay';
import { tokens } from '../theme/tokens';
import { useChat } from '../hooks/useChat';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock, ChatInputDockRef } from '../components/chat/ChatInputDock';
import { ChatHistoryDrawer } from '../components/chat/ChatHistoryDrawer';
import { ChatEmptyWelcome } from '../components/chat/ChatEmptyWelcome';
import { ThinkingProcessAccordion } from '../components/chat/ThinkingProcessAccordion';
import { ModelPickerSheet } from '../components/ai/ModelPickerSheet';
import { useChatModelSelection } from '../hooks/useChatModelSelection';
import { useChatImagePicker } from '../hooks/useChatImagePicker';
import { navigateToAiProviders } from '../navigation/navigationRef';
import { pickWelcomeGreeting } from '../utils/chatGreetings';
import { resolveKeyboardHeight } from '../utils/keyboardHeight';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SafeAudioRecorder } from '../services/audioRecorder';
import { pagerSwipeLockBus } from '../services/dataSync';
import { styles } from './ChatScreen.styles';

export interface ChatScreenProps {
  onDataChanged?: () => void;
  onKeyboardStateChange?: (isOpen: boolean) => void;
  onLoadingStateChange?: (loading: boolean) => void;
}

export interface ChatScreenRef {
  openHistory: () => void;
  startNewChat: () => void;
  submitExternalPrompt: (text: string) => void;
  askAssistantQuestion: (question: string, focusMode?: string) => void;
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
    streamingSteps,
    sessions,
    activeSessionId,
    sendMessage,
    appendUserMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
    togglePinConversation,
  } = useChat(onDataChanged, user?.id);

  const chatModel = useChatModelSelection(activeSessionId, sessions);
  const {
    selectedImageUri,
    selectedImageBase64,
    selectedImageMime,
    clearSelectedImage,
    handlePickImage,
  } = useChatImagePicker(loading);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [deckGestureActive, setDeckGestureActive] = useState(false);

  useEffect(() => {
    return pagerSwipeLockBus.subscribe((locked) => {
      setDeckGestureActive(locked);
    });
  }, []);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<ChatInputDockRef>(null);
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
      inputRef.current?.clear();
      clearSelectedImage();
      startNewConversation();
    },
    submitExternalPrompt: (text: string) => {
      if (text.trim()) {
        sendMessage(text.trim());
      }
    },
    askAssistantQuestion: (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      appendAssistantMessage(trimmed);
      setTimeout(() => {
        inputRef.current?.focus?.();
      }, 150);
    },
  }), [startNewConversation, sendMessage, appendAssistantMessage]);


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

  const handleSend = (text: string) => {
    if ((!text.trim() && !selectedImageUri) || loading) return;

    if (selectedImageUri) {
      const uri = selectedImageUri;
      const b64 = selectedImageBase64 || undefined;
      const mime = selectedImageMime || undefined;
      const prompt = text.trim() || undefined;
      clearSelectedImage();
      sendImage(uri, prompt, b64, mime);
    } else {
      sendMessage(text);
    }
    // Mantém teclado aberto e foco para a próxima mensagem (1 toque sempre).
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return;
    sendMessage(prompt);
  };

  const handleEditMessage = (text: string) => {
    inputRef.current?.setDraft(text);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSelectSlot = (slot: import('../types').TimeSlot, msg: import('../types').ChatMessage) => {
    if (loading) return;
    const title = msg.event?.title || msg.conflict?.conflicting_title;
    if (title) {
      sendMessage(`Reagendar "${title}" para ${slot.label}`);
    } else {
      sendMessage(`Reagendar compromisso para ${slot.label}`);
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
        await sendAudio(result.uri);
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
        scrollEnabled={!deckGestureActive}
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
          <ChatEmptyWelcome
            userName={firstName}
            welcomeGreeting={welcomeGreeting}
            loading={loading}
            onSelectIdea={handleQuickPrompt}
          />
        }
        ListFooterComponent={
          loading ? <ThinkingProcessAccordion steps={streamingSteps} isStreaming={true} /> : null
        }
      />

      {/* Chips Rápidos de Sugestões Executivas (Início do Chat) */}
      {messages.length > 0 && messages.length <= 2 && !isKeyboardOpen && (
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
          ref={inputRef}
          onSend={handleSend}
          loading={loading}
          onStop={stopGeneration}
          isRecording={isRecording}
          onPressMic={handleToggleRecording}
          onPressLiveVoice={() => setIsVoiceModeActive(true)}
          onCancelRecording={handleCancelRecording}
          onPressAttach={handlePickImage}
          selectedImageUri={selectedImageUri}
          onClearImage={clearSelectedImage}
          modelLabel={chatModel.pillLabel}
          modelDotColor={chatModel.pillDotColor}
          onPressModel={() => chatModel.setPickerVisible(true)}
        />
      </View>
      {!!chatModel.toastMessage && (
        <View style={[styles.modelToast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.modelToastText, { color: colors.bg }]}>
            {chatModel.toastMessage}
          </Text>
        </View>
      )}
      <ChatHistoryDrawer
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onNewChat={startNewConversation}
        conversations={sessions}
        onSelectConversation={switchConversation}
        onDeleteConversation={deleteConversation}
        onTogglePin={togglePinConversation}
      />
      <ModelPickerSheet
        visible={chatModel.pickerVisible}
        onClose={() => chatModel.setPickerVisible(false)}
        scopeLabel="Esta conversa"
        allowInherit={true}
        selectedModel={chatModel.threadModel}
        inheritedModel={chatModel.defaultModel}
        selectedEffort={chatModel.threadEffort}
        groups={chatModel.modelGroups}
        onSelectModel={chatModel.selectThreadModel}
        onSelectEffort={chatModel.selectThreadEffort}
        onManageProviders={navigateToAiProviders}
      />
      {isVoiceModeActive && (
        <Modal
          transparent
          visible={isVoiceModeActive}
          animationType="fade"
          onRequestClose={() => setIsVoiceModeActive(false)}
        >
          <VitoVoiceOverlay
            triggerSource="MANUAL"
            variant="fullscreen"
            screenContext="Chat"
            onClose={() => setIsVoiceModeActive(false)}
            onSwitchToText={() => {
              setIsVoiceModeActive(false);
              setTimeout(() => {
                inputRef.current?.focus?.();
              }, 200);
            }}
            onMessageExchange={(userText, aiReply) => {
              if (userText?.trim()) {
                appendUserMessage(userText.trim());
              }
              if (aiReply?.trim()) {
                appendAssistantMessage(aiReply.trim());
              }
            }}
          />
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
});

