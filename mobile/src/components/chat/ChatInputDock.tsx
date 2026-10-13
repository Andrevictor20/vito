import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { shouldTriggerSend } from '../../utils/chatSendGuard';

interface ChatInputDockProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading?: boolean;
  onStop?: () => void;
  onPressMic?: () => void;
  isRecording?: boolean;
  onCancelRecording?: () => void;
  onPressAttach?: () => void;
  selectedImageUri?: string | null;
  onClearImage?: () => void;
  inputRef?: React.RefObject<any>;
  onRefusedSend?: (reason: 'empty' | 'loading' | 'debounced') => void;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  value,
  onChangeText,
  onSend,
  loading = false,
  onStop,
  onPressMic,
  isRecording = false,
  onCancelRecording,
  onPressAttach,
  selectedImageUri,
  onClearImage,
  inputRef,
  onRefusedSend,
}) => {
  const { colors, isDark } = useTheme();
  const canSend = (value.trim().length > 0 || !!selectedImageUri) && !loading;

  // Disparo único por toque: onPress exclusivo (sem onPressIn duplicado) com
  // guarda pura por timestamp. Layout estável: o botão limpar ocupa espaço
  // fixo sempre (só alterna opacidade), então o botão enviar nunca se move
  // entre toques — causa raiz do "1º toque só fecha o teclado".
  const lastSentAtRef = React.useRef(0);

  const handleTriggerSend = () => {
    const decision = shouldTriggerSend({
      hasContent: value.trim().length > 0 || !!selectedImageUri,
      loading,
      now: Date.now(),
      lastSentAt: lastSentAtRef.current,
    });
    if (!decision.allowed) {
      onRefusedSend?.(decision.reason!);
      return;
    }
    lastSentAtRef.current = decision.sentAt;
    onSend();
  };

  return (
    <View style={styles.dockWrapper}>
      {/* Pré-visualização da Imagem Anexada */}
      {selectedImageUri && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={onClearImage}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Remover foto anexada"
          >
            <MaterialIcons name="close" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.capsule, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
        {/* Botão de Cancelar Gravação (Descartar áudio sem enviar) */}
        {isRecording && onCancelRecording && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
            onPress={onCancelRecording}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Cancelar gravação de áudio"
          >
            <MaterialIcons name="delete-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}

        {/* Botão de Ditado / Microfone Tonal M3 */}
        <TouchableOpacity
          style={[styles.iconButton, isRecording ? styles.micButtonRecording : { backgroundColor: colors.surfaceContainerHighest }]}
          onPress={onPressMic}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel={isRecording ? 'Concluir e enviar áudio' : 'Gravar áudio com Vito'}
        >
          <MaterialIcons
            name={isRecording ? 'check' : 'mic'}
            size={20}
            color={isRecording ? '#FFFFFF' : colors.primary}
          />
        </TouchableOpacity>

        {/* Campo de Entrada de Texto M3 */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.onSurface }]}
          placeholder={
            isRecording
              ? 'Gravando áudio... Conclua ou cancele'
              : 'Instrua o Vito ou pergunte algo...'
          }
          placeholderTextColor={isRecording ? colors.error : colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
          returnKeyType="default"
        />

        {/* Botão de Limpar: espaço fixo sempre reservado (só opacidade alterna)
            para o botão enviar nunca se deslocar entre toques. */}
        <TouchableOpacity
          style={[styles.iconButton, styles.clearButtonSlot, { opacity: value.length > 0 && !loading ? 1 : 0 }]}
          onPress={() => onChangeText('')}
          disabled={!(value.length > 0 && !loading)}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Limpar texto digitado"
        >
          <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Botão de Anexo / Contexto M3 (oculto durante gravação) */}
        {onPressAttach && !isRecording && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressAttach}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Anexar imagem ou documento"
          >
            <MaterialIcons name="add-photo-alternate" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* Botão Primário: Interromper (Stop) durante loading OU Envio M3.
            Disparo exclusivo via onPress — sem onPressIn duplicado. */}
        {loading ? (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.error || '#EF4444' },
            ]}
            onPress={() => onStop?.()}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Interromper geração de resposta"
          >
            <MaterialIcons name="stop" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surfaceContainerHighest, shadowOpacity: 0, elevation: 0 },
            ]}
            onPress={handleTriggerSend}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Enviar mensagem"
          >
            <MaterialIcons
              name="arrow-upward"
              size={20}
              color={canSend ? colors.onPrimary : colors.outline}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    backgroundColor: 'transparent',
  },
  imagePreviewContainer: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    position: 'relative',
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  // Cápsula Arredondada M3 (Surface Container High, 28dp radius)
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: MD3Shapes.extraLarge,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    gap: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonSlot: {
    width: 32,
    height: 32,
  },
  micButtonIdle: {
    backgroundColor: tokens.colors.surfaceContainerHighest,
  },
  micButtonRecording: {
    backgroundColor: tokens.colors.errorContainer,
  },
  input: {
    flex: 1,
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.bodyMedium,
    lineHeight: 22,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 8,
    minHeight: 42,
    maxHeight: 96,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceContainerHighest,
    shadowOpacity: 0,
    elevation: 0,
  },
});
