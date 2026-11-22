import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Modal,
  Platform,
  Text,
  View,
} from 'react-native';
import {
  ChatAttachmentOption,
  ChatAttachmentSheet,
} from '../components/chat/ChatAttachmentSheet';
import { ChatEmptyWelcome } from '../components/chat/ChatEmptyWelcome';
import { ChatHistoryDrawer } from '../components/chat/ChatHistoryDrawer';
import { ChatInputDock, ChatInputDockRef } from '../components/chat/ChatInputDock';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ThinkingProcessAccordion } from '../components/chat/ThinkingProcessAccordion';
import { ModelPickerSheet } from '../components/ai/ModelPickerSheet';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useChat } from '../hooks/useChat';
import { useChatImagePicker } from '../hooks/useChatImagePicker';
import { useChatModelSelection } from '../hooks/useChatModelSelection';
import { navigateToAiProviders } from '../navigation/navigationRef';
import { VitoVoiceOverlay } from '../overlay/VitoVoiceOverlay';
import { SafeAudioRecorder } from '../services/audioRecorder';
import { pagerSwipeLockBus } from '../services/dataSync';
import type { ChatMessage, TimeSlot } from '../types';
import { pickWelcomeGreeting } from '../utils/chatGreetings';
import { resolveKeyboardHeight } from '../utils/keyboardHeight';
import { styles } from './ChatScreen.styles';

let ImagePickerModule: typeof import('expo-image-picker') | null = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}

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

export const ChatScreen = forwardRef<ChatScreenRef, ChatScreenProps>(
  ({ onDataChanged, onKeyboardStateChange, onLoadingStateChange }, ref) => {
    const { user } = useAuth();
    const { colors } = useTheme();
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
    } = useChatImagePicker(loading);

    const [pickedAttachment, setPickedAttachment] = useState<{
      uri: string;
      base64?: string;
      mime?: string;
    } | null>(null);
    const [attachSheetVisible, setAttachSheetVisible] = useState(false);
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
    const keyboardOpenRef = useRef(false);
    const keyboardHeightRef = useRef(0);

    const welcomeGreeting = React.useMemo(
      () => pickWelcomeGreeting(firstName, new Date().getHours()),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const clearAttachments = () => {
      clearSelectedImage();
      setPickedAttachment(null);
    };

    useImperativeHandle(
      ref,
      () => ({
        openHistory: () => setHistoryVisible(true),
        startNewChat: () => {
          inputRef.current?.clear();
          clearAttachments();
          startNewConversation();
        },
        submitExternalPrompt: (text: string) => {
          if (text.trim()) {
            void sendMessage(text.trim());
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
      }),
      [startNewConversation, sendMessage, appendAssistantMessage]
    );

    useEffect(() => {
      onLoadingStateChange?.(loading);
    }, [loading, onLoadingStateChange]);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const onShow = (e: KeyboardEvent) => {
        const h = e?.endCoordinates?.height || 0;
        const resolved = resolveKeyboardHeight(
          keyboardHeightRef.current,
          keyboardOpenRef.current,
          h
        );
        if (resolved === null) return;
        keyboardHeightRef.current = resolved;
        keyboardOpenRef.current = true;
        setKeyboardHeight(resolved);
        setIsKeyboardOpen(true);
        onKeyboardStateChange?.(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
      };

      const onHide = () => {
        keyboardHeightRef.current = 0;
        keyboardOpenRef.current = false;
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
        onKeyboardStateChange?.(false);
      };

      const subShow = Keyboard.addListener(showEvent, onShow);
      const subHide = Keyboard.addListener(hideEvent, onHide);
      return () => {
        subShow.remove();
        subHide.remove();
      };
    }, [onKeyboardStateChange]);

    useEffect(() => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }, [messages.length, loading]);

    const activeImageUri = pickedAttachment?.uri ?? selectedImageUri;
    const activeImageBase64 = pickedAttachment?.base64 ?? selectedImageBase64;
    const activeImageMime = pickedAttachment?.mime ?? selectedImageMime;

    const handleSend = (text: string) => {
      if ((!text.trim() && !activeImageUri) || loading) return;

      if (activeImageUri) {
        const uri = activeImageUri;
        const b64 = activeImageBase64 || undefined;
        const mime = activeImageMime || undefined;
        const prompt = text.trim() || undefined;
        clearAttachments();
        void sendImage(uri, prompt, b64, mime);
      } else {
        void sendMessage(text);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleAttachmentOption = async (option: ChatAttachmentOption) => {
      if (loading) return;
      if (option === 'pdf') {
        inputRef.current?.setDraft('Analisar documento PDF: ');
        return;
      }
      if (!ImagePickerModule) {
        Alert.alert('Anexos', 'Módulo de mídia não disponível neste ambiente.');
        return;
      }
      try {
        const useCamera = option === 'camera';
        const perm = useCamera
          ? await ImagePickerModule.requestCameraPermissionsAsync()
          : await ImagePickerModule.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            useCamera ? 'Permissão da Câmera' : 'Permissão de Fotos',
            useCamera
              ? 'Conceda permissão da câmera para fotografar boletos, convites ou anotações.'
              : 'Conceda permissão da galeria para enviar comprovantes ou prints.'
          );
          return;
        }
        const opts = {
          mediaTypes: ImagePickerModule.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        };
        const res = useCamera
          ? await ImagePickerModule.launchCameraAsync(opts)
          : await ImagePickerModule.launchImageLibraryAsync(opts);
        if (!res.canceled && res.assets?.[0]) {
          const asset = res.assets[0];
          setPickedAttachment({
            uri: asset.uri,
            base64: asset.base64 ?? undefined,
            mime: asset.mimeType ?? undefined,
          });
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar a imagem selecionada.');
      }
    };

    const handleQuickPrompt = (prompt: string) => {
      if (loading) return;
      void sendMessage(prompt);
    };

    const handleEditMessage = (text: string) => {
      inputRef.current?.setDraft(text);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const handleSelectSlot = (slot: TimeSlot, msg: ChatMessage) => {
      if (loading) return;
      const title = msg.event?.title || msg.conflict?.conflicting_title;
      if (title) {
        void sendMessage(`Reagendar "${title}" para ${slot.label}`);
      } else {
        void sendMessage(`Reagendar compromisso para ${slot.label}`);
      }
    };

    const handleToggleRecording = async () => {
      if (loading) return;

      if (!isRecording) {
        if (!SafeAudioRecorder.isAudioSupported()) {
          Alert.alert(
            'Gravação de Áudio',
            'O módulo de gravação de áudio nativo não está disponível neste ambiente.'
          );
          return;
        }
        const granted = await SafeAudioRecorder.requestPermissions();
        if (!granted) {
          Alert.alert(
            'Microfone Necessário',
            'Por favor, conceda permissão de microfone para enviar mensagens de voz ao Vito.'
          );
          return;
        }
        const started = await SafeAudioRecorder.startRecording();
        if (started) {
          setIsRecording(true);
        } else {
          Alert.alert('Gravação', 'Não foi possível iniciar a gravação de áudio no momento.');
        }
      } else {
        setIsRecording(false);
        const result = await SafeAudioRecorder.stopRecording();
        if (result?.uri) {
          await sendAudio(result.uri);
        }
      }
    };

    const handleCancelRecording = async () => {
      if (!isRecording) return;
      setIsRecording(false);
      try {
        await SafeAudioRecorder.stopRecording();
      } catch {
        // ignore
      }
    };

    return (
      <KeyboardAvoidingView
        style={[
          styles.container,
          {
            backgroundColor: colors.bg,
            paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
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
            loading ? (
              <ThinkingProcessAccordion steps={streamingSteps} isStreaming={true} />
            ) : null
          }
        />

        <View
          style={[
            styles.dockContainer,
            {
              paddingBottom: isKeyboardOpen
                ? 28
                : Platform.OS === 'ios'
                  ? 96
                  : 98,
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
            onPressAttach={() => setAttachSheetVisible(true)}
            selectedImageUri={activeImageUri}
            onClearImage={clearAttachments}
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

        <ChatAttachmentSheet
          visible={attachSheetVisible}
          onClose={() => setAttachSheetVisible(false)}
          onSelectOption={(opt) => void handleAttachmentOption(opt)}
        />

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
                if (userText?.trim()) appendUserMessage(userText.trim());
                if (aiReply?.trim()) appendAssistantMessage(aiReply.trim());
              }}
            />
          </Modal>
        )}
      </KeyboardAvoidingView>
    );
  }
);
