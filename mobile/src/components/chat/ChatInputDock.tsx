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

interface ChatInputDockProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading?: boolean;
  onPressMic?: () => void;
  isRecording?: boolean;
  onPressAttach?: () => void;
  selectedImageUri?: string | null;
  onClearImage?: () => void;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  value,
  onChangeText,
  onSend,
  loading = false,
  onPressMic,
  isRecording = false,
  onPressAttach,
  selectedImageUri,
  onClearImage,
}) => {
  const canSend = (value.trim().length > 0 || !!selectedImageUri) && !loading;

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

      <View style={styles.capsule}>
        {/* Botão de Ditado / Microfone Tonal M3 */}
        <TouchableOpacity
          style={[styles.iconButton, isRecording ? styles.micButtonRecording : styles.micButtonIdle]}
          onPress={onPressMic}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel={isRecording ? 'Parar gravação' : 'Gravar áudio com Vito'}
        >
          <MaterialIcons
            name={isRecording ? 'stop' : 'mic'}
            size={20}
            color={isRecording ? tokens.colors.onErrorContainer : tokens.colors.primary}
          />
        </TouchableOpacity>

        {/* Campo de Entrada de Texto M3 */}
        <TextInput
          style={styles.input}
          placeholder={isRecording ? 'Ouvindo... Toque no botão para concluir' : 'Instrua o Vito ou pergunte algo...'}
          placeholderTextColor={isRecording ? tokens.colors.error : tokens.colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
          returnKeyType="default"
        />

        {/* Botão de Anexo / Contexto M3 */}
        {onPressAttach && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressAttach}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Anexar imagem ou documento"
          >
            <MaterialIcons name="add-photo-alternate" size={20} color={tokens.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* Botão Primário de Envio M3 (Filled Circle) */}
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.8}
          accessibilityLabel="Enviar mensagem"
        >
          {loading ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <MaterialIcons
              name="arrow-upward"
              size={20}
              color={canSend ? tokens.colors.onPrimary : tokens.colors.outline}
            />
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 6,
    paddingVertical: 5,
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
    lineHeight: tokens.typography.lineHeight.bodyMedium,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 6,
    maxHeight: 90,
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
