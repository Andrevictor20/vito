import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { shouldTriggerSend } from '../../utils/chatSendGuard';
import { FocusMode } from '../../types/focus';
import { hapticFeedback } from '../../theme/motion';

interface ChatInputDockProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading?: boolean;
  onStop?: () => void;
  onPressMic?: () => void;
  onPressLiveVoice?: () => void;
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
  onPressLiveVoice,
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
  const { colors } = useTheme();
  const canSend = (value.trim().length > 0 || !!selectedImageUri) && !loading;
  const lastSentAtRef = useRef(0);

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
    hapticFeedback.medium();
    onSend();
  };

  return (
    <View style={styles.dockWrapper}>
      {/* Pré-visualização da Imagem Anexada */}
      {selectedImageUri && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          <TouchableOpacity
            style={[styles.removeImageButton, { backgroundColor: colors.ink }]}
            onPress={onClearImage}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Remover foto anexada"
          >
            <MaterialIcons name="close" size={13} color={colors.bg} />
          </TouchableOpacity>
        </View>
      )}

      {/* Composer arredondado .cmp fiel a vito-telas.html */}
      <View
        style={[
          styles.cmp,
          {
            backgroundColor: colors.surf,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Linha Superior (.crow): Anexo (+) e Foco em */}
        <View style={styles.crowTop}>
          {onPressAttach && !isRecording && (
            <TouchableOpacity
              style={[
                styles.circ,
                { backgroundColor: colors.bg, borderColor: colors.line },
              ]}
              onPress={onPressAttach}
              activeOpacity={0.7}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Anexar imagem ou documento"
            >
              <MaterialIcons name="add" size={20} color={colors.ink} />
            </TouchableOpacity>
          )}

          {/* Foco em (.focus) */}
          {onPressFocus && (
            selectedFocus ? (
              <View
                style={[
                  styles.focusPillActive,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.focusPillTouchable}
                  onPress={onPressFocus}
                  activeOpacity={0.7}
                  accessibilityLabel={`Foco em: ${selectedFocus.title}`}
                >
                  <MaterialIcons name={selectedFocus.iconName as any} size={13} color={colors.primary} />
                  <Text style={[styles.focusTextActive, { color: colors.primary }]} numberOfLines={1}>
                    {selectedFocus.title}
                  </Text>
                </TouchableOpacity>
                {onClearFocus && (
                  <TouchableOpacity
                    style={styles.focusClear}
                    onPress={onClearFocus}
                    hitSlop={tokens.hitSlop.sm}
                    accessibilityLabel="Remover foco"
                  >
                    <MaterialIcons name="close" size={12} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.focusPill,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.line,
                  },
                ]}
                onPress={onPressFocus}
                activeOpacity={0.7}
                accessibilityLabel="Selecionar foco de IA"
              >
                <MaterialIcons name="tune" size={13} color={colors.ink} />
                <Text style={[styles.focusText, { color: colors.ink }]}>
                  Foco em
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={13} color={colors.muted} />
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Linha Inferior (.crow): Campo de Texto + Mic + Enviar */}
        <View style={styles.crowBottom}>
          <TextInput
            ref={inputRef}
            style={[styles.fieldInput, { color: colors.ink }]}
            placeholder={
              isRecording
                ? 'Gravando áudio... Conclua ou cancele'
                : 'Instrua o Vito ou pergunte algo...'
            }
            placeholderTextColor={isRecording ? colors.red : colors.muted}
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={1000}
            blurOnSubmit={false}
            returnKeyType="default"
          />

          {/* Botão limpar texto */}
          {value.length > 0 && !loading && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onChangeText('')}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Limpar texto digitado"
            >
              <MaterialIcons name="close" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}

          {/* Cancelar Gravação */}
          {isRecording && onCancelRecording && (
            <TouchableOpacity
              style={[styles.circ, { backgroundColor: colors.redBg, borderColor: colors.red }]}
              onPress={onCancelRecording}
              activeOpacity={0.7}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Cancelar gravação"
            >
              <MaterialIcons name="delete-outline" size={18} color={colors.red} />
            </TouchableOpacity>
          )}

          {/* Botão Microfone (.circ) */}
          <TouchableOpacity
            style={[
              styles.circ,
              { backgroundColor: colors.bg, borderColor: colors.line },
              isRecording && { backgroundColor: colors.red, borderColor: colors.red },
            ]}
            onPress={onPressMic}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel={isRecording ? 'Concluir gravação' : 'Gravar áudio com Vito'}
          >
            <MaterialIcons
              name={isRecording ? 'check' : 'mic'}
              size={19}
              color={isRecording ? '#ffffff' : colors.ink}
            />
          </TouchableOpacity>

          {/* Botão Live Voice (.circ.wv) idêntico ao vito-telas.html */}
          {onPressLiveVoice && value.trim().length === 0 && !isRecording && (
            <TouchableOpacity
              style={[
                styles.circWv,
                { backgroundColor: colors.ink },
              ]}
              onPress={() => {
                hapticFeedback.light();
                onPressLiveVoice();
              }}
              activeOpacity={0.75}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Conversar por voz com o Vito"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4"
                  stroke={colors.bg}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          )}

          {/* Botão Enviar / Parar (.circ.send) */}
          {loading ? (
            <TouchableOpacity
              style={[styles.circ, styles.sendBtn, { backgroundColor: colors.red, borderColor: colors.red, opacity: 1 }]}
              onPress={() => onStop?.()}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Interromper geração"
            >
              <MaterialIcons name="stop" size={19} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.circ,
                styles.sendBtn,
                {
                  backgroundColor: colors.ink,
                  borderColor: colors.ink,
                  opacity: canSend ? 1 : 0.35,
                },
              ]}
              onPress={handleTriggerSend}
              disabled={!canSend}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Enviar mensagem"
            >
              <MaterialIcons
                name="arrow-upward"
                size={19}
                color={colors.bg}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  imagePreviewContainer: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    position: 'relative',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .cmp arredondado de 28px
  cmp: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  crowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  crowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circ: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circWv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    marginLeft: 2,
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  focusText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  focusPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  focusPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  focusTextActive: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  focusClear: {
    padding: 2,
  },
  fieldInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  clearBtn: {
    padding: 6,
  },
});
