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
}) => {
  const { colors, isDark } = useTheme();
  const canSend = (value.trim().length > 0 || !!selectedImageUri) && !loading;

  // Garante disparo confiável sem eventos duplicados.
  // Refs espelham o estado atual para que onPressIn (disparado antes do blur do
  // teclado / salto de layout no Android) nunca use closure obsoleta — causa raiz
  // do "preciso clicar 2 vezes para enviar".
  const isSendingRef = React.useRef(false);
  const stopReadyTimestampRef = React.useRef(0);
  const canSendRef = React.useRef(canSend);
  const onSendRef = React.useRef(onSend);
  React.useEffect(() => {
    canSendRef.current = canSend;
  }, [canSend]);
  React.useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  React.useEffect(() => {
    if (loading) {
      stopReadyTimestampRef.current = Date.now() + 600;
    }
  }, [loading]);

  const handleTriggerSend = () => {
    if (isSendingRef.current || !canSendRef.current) return;
    isSendingRef.current = true;
    onSendRef.current?.();
    setTimeout(() => {
      isSendingRef.current = false;
    }, 400);
  };

  const handleStop = () => {
    // Ignora cliques residuais que soltaram no mesmo momento da transição de estado
    if (Date.now() < stopReadyTimestampRef.current) return;
    onStop?.();
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

        {/* Botão de Limpar / Descartar Digitação */}
        {value.length > 0 && !loading && (
          <TouchableOpacity
            style={[styles.iconButton, { width: 32, height: 32 }]}
            onPress={() => onChangeText('')}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Limpar texto digitado"
          >
            <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

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

        {/* Botão Primário: Interromper (Stop) durante loading OU Envio M3 */}
        {loading ? (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.error || '#EF4444' },
            ]}
            onPressIn={handleStop}
            onPress={handleStop}
            delayPressIn={0}
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
            onPressIn={handleTriggerSend}
            onPress={handleTriggerSend}
            delayPressIn={0}
            disabled={!canSend}
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
