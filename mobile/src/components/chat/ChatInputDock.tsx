import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { shouldTriggerSend } from '../../utils/chatSendGuard';
import { FocusMode } from '../../types/focus';

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
  selectedFocus?: FocusMode | null;
  onPressFocus?: () => void;
  onClearFocus?: () => void;
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
  selectedFocus,
  onPressFocus,
  onClearFocus,
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

      {/* Barra de Chat Expandida M3 (com Ações e Foco em Embutidos) */}
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {/* Linha Superior Interna: Ações Rápidas & Foco em */}
        <View style={styles.capsuleHeader}>
          {/* Botão de Anexo / Foto (+) */}
          {onPressAttach && !isRecording && (
            <TouchableOpacity
              style={[
                styles.attachButton,
                { backgroundColor: colors.surfaceContainerHighest },
              ]}
              onPress={onPressAttach}
              activeOpacity={0.7}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Anexar imagem ou documento"
            >
              <MaterialIcons name="add" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}

          {/* Botão Foco em Embutido */}
          {onPressFocus && (
            selectedFocus ? (
              <View
                style={[
                  styles.focusPillActive,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.12)',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.focusPillTouchable}
                  onPress={onPressFocus}
                  activeOpacity={0.7}
                  accessibilityLabel={`Foco em: ${selectedFocus.title}. Toque para alterar.`}
                >
                  <MaterialIcons name={selectedFocus.iconName as any} size={14} color={colors.primary} />
                  <Text style={[styles.focusPillTextActive, { color: colors.primary }]} numberOfLines={1}>
                    Foco: {selectedFocus.title}
                  </Text>
                </TouchableOpacity>
                {onClearFocus && (
                  <TouchableOpacity
                    style={styles.focusPillClear}
                    onPress={onClearFocus}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Remover foco"
                  >
                    <MaterialIcons name="close" size={13} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.focusPillInactive,
                  {
                    backgroundColor: colors.surfaceContainerHighest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={onPressFocus}
                activeOpacity={0.7}
                accessibilityLabel="Selecionar foco de IA"
              >
                <MaterialIcons name="tune" size={14} color={colors.onSurfaceVariant} />
                <Text style={[styles.focusPillTextInactive, { color: colors.onSurfaceVariant }]}>
                  Foco em
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Linha Principal: Campo de Digitação Amplo e Controles */}
        <View style={styles.capsuleMainRow}>
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

          {/* Grupo de Ações à Direita */}
          <View style={styles.actionGroupRight}>
            {/* Botão de Limpar: visível apenas quando há texto */}
            {value.length > 0 && !loading && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => onChangeText('')}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Limpar texto digitado"
              >
                <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}

            {/* Cancelar Gravação (Descartar áudio sem enviar) */}
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

            {/* Botão de Microfone / Ditado Whisper */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                isRecording ? styles.micButtonRecording : { backgroundColor: colors.surfaceContainerHighest },
              ]}
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

            {/* Botão Primário: Enviar ou Interromper */}
            {loading ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: colors.error || '#EF4444' },
                ]}
                onPress={() => onStop?.()}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    marginBottom: 8,
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
  // Barra de Chat Ampliada M3 (26dp radius, layout de dois níveis)
  capsule: {
    flexDirection: 'column',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  capsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  attachButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  focusPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  focusPillTextActive: {
    fontSize: 12,
    fontWeight: '600',
  },
  focusPillClear: {
    padding: 2,
    marginLeft: 2,
  },
  focusPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  focusPillTextInactive: {
    fontSize: 12,
    fontWeight: '500',
  },
  capsuleMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  input: {
    flex: 1,
    color: tokens.colors.onSurface,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 6,
    paddingVertical: 8,
    minHeight: 46,
    maxHeight: 120,
  },
  actionGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: tokens.colors.errorContainer,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
