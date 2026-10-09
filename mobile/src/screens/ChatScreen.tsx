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
import { ChatQuotaBanner } from '../components/chat/ChatQuotaBanner';
import { ChatQuickChips } from '../components/chat/ChatQuickChips';
import { ChatInputDock } from '../components/chat/ChatInputDock';
import { ConversationHistoryModal } from '../components/chat/ConversationHistoryModal';
import { VitoMascot } from '../components/common/VitoMascot';
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
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
  } = useChat(onDataChanged);
  const [inputText, setInputText] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useImperativeHandle(ref, () => ({
    openHistory: () => setHistoryVisible(true),
  }), []);

  useEffect(() => {
    onLoadingStateChange?.(loading);
  }, [loading, onLoadingStateChange]);

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
      const prompt = inputText.trim() || undefined;
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setInputText('');
      sendImage(uri, prompt, b64);
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surface }]}
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
          />
        )}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.emptyMessagesList,
          { paddingBottom: isKeyboardOpen ? tokens.spacing.sm : 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyWelcomeContainer}>
            <View style={styles.emptyMascotWrapper}>
              <VitoMascot size={64} state={loading ? 'thinking' : 'idle'} />
            </View>
            <Text style={[styles.emptyWelcomeTitle, { color: colors.onSurface }]}>
              Olá, {firstName}
            </Text>
            <Text style={[styles.emptyWelcomeSubtitle, { color: colors.onSurfaceVariant }]}>
              Sou seu secretário executivo com IA. Como posso organizar sua rotina, compromissos ou tarefas hoje?
            </Text>
          </View>
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
          onClearImage={() => {
            setSelectedImageUri(null);
            setSelectedImageBase64(null);
          }}
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
  emptyWelcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xl,
  },
  emptyMascotWrapper: {
    marginBottom: tokens.spacing.md,
  },
  emptyWelcomeTitle: {
    fontSize: tokens.typography.size.headlineSmall,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  emptyWelcomeSubtitle: {
    fontSize: tokens.typography.size.bodyMedium,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  suggestionsWrapper: {
    paddingBottom: 4,
  },
  dockContainer: {
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'android' ? 8 : 8,
  },
});
