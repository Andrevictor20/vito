import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronDownSvgIcon,
  CloseSvgIcon,
  MicSvgIcon,
  PlusSvgIcon,
  ProtoUiIcon,
  SendUpSvgIcon,
  WaveSvgIcon,
} from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { getFloatingSurfaceShadow } from '../../../theme/surfaces';
import { tokens, v5Radii } from '../../../theme/tokens';
import { MOTION_CURVES, hapticFeedback } from '../../../theme/motion';
import { useReduceMotion } from '../../../theme/vitoMotion';
import { prepareEditDraft } from '../utils/chatActions';
import { shouldTriggerSend } from '../utils/chatSendGuard';

export interface ChatInputDockRef {
  focus: () => void;
  clear: () => void;
  setDraft: (text: string) => void;
  insertTranscript: (text: string) => void;
  getText: () => string;
}

interface ChatInputDockProps {
  onSend: (text: string) => void;
  loading?: boolean;
  onStop?: () => void;
  onPressMic?: () => void;
  onPressLiveVoice?: () => void;
  isRecording?: boolean;
  onCancelRecording?: () => void;
  onPressAttach?: () => void;
  selectedImageUri?: string | null;
  onClearImage?: () => void;
  onRefusedSend?: (reason: 'empty' | 'loading' | 'debounced') => void;
  modelLabel?: string;
  modelDotColor?: string;
  onPressModel?: () => void;
}

export const ChatInputDock = forwardRef<ChatInputDockRef, ChatInputDockProps>(
  (
    {
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
      onRefusedSend,
      modelLabel = 'Vito Auto',
      modelDotColor,
      onPressModel,
    },
    ref
  ) => {
    const { colors, isDark } = useTheme();
    const reduceMotion = useReduceMotion();
    const [inputText, setInputText] = useState('');
    const inputTextRef = useRef('');
    const textInputRef = useRef<TextInput>(null);
    const hasTextOrImage = inputText.trim().length > 0 || !!selectedImageUri;
    const canSend = hasTextOrImage && !loading;
    const lastSentAtRef = useRef(0);
    const sendPopAnim = useRef(new Animated.Value(1)).current;
    const prevHasText = useRef(hasTextOrImage);

    useEffect(() => {
      if (hasTextOrImage && !prevHasText.current && !reduceMotion) {
        sendPopAnim.setValue(0.6);
        Animated.timing(sendPopAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.bezier(...MOTION_CURVES.q),
          useNativeDriver: true,
        }).start();
      }
      prevHasText.current = hasTextOrImage;
    }, [hasTextOrImage, reduceMotion, sendPopAnim]);

    const updateInputText = (next: string) => {
      inputTextRef.current = next;
      setInputText(next);
    };

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          textInputRef.current?.focus();
        },
        clear: () => {
          updateInputText('');
        },
        setDraft: (text: string) => {
          const next = prepareEditDraft(inputTextRef.current, text);
          updateInputText(next);
          requestAnimationFrame(() => textInputRef.current?.focus());
        },
        insertTranscript: (text: string) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          const current = inputTextRef.current.trimEnd();
          const next = current ? `${current} ${trimmed}` : trimmed;
          updateInputText(next);
        },
        getText: () => inputTextRef.current,
      }),
      []
    );

    const handleTriggerSend = () => {
      const currentText = inputTextRef.current;
      const decision = shouldTriggerSend({
        hasContent: currentText.trim().length > 0 || !!selectedImageUri,
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
      updateInputText('');
      onSend(currentText);
    };

    return (
      <View style={styles.dockWrapper}>
        {selectedImageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
            <TouchableOpacity
              style={[styles.removeImageButton, { backgroundColor: colors.ink }]}
              onPress={onClearImage}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Remover foto anexada"
            >
              <CloseSvgIcon size={13} color={colors.bg} />
            </TouchableOpacity>
          </View>
        )}

        {/* Composer limpo de 2 linhas (.cmp) */}
        <View
          style={[
            styles.cmp,
            getFloatingSurfaceShadow(isDark),
            {
              backgroundColor: colors.bg,
              borderColor: colors.hairline,
            },
          ]}
        >
          {/* Linha 1: + Anexos e Pill de Modelo (#c-model) */}
          <View style={styles.crowTop}>
            {onPressAttach && !isRecording && (
              <TouchableOpacity
                style={[styles.circ, { backgroundColor: colors.btn }]}
                onPress={onPressAttach}
                activeOpacity={0.75}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Anexar arquivo ou imagem"
                testID="c-attach"
              >
                <PlusSvgIcon size={19} color={colors.ink} />
              </TouchableOpacity>
            )}

            {onPressModel && (
              <TouchableOpacity
                style={[styles.modelPill, { backgroundColor: colors.btn }]}
                onPress={onPressModel}
                activeOpacity={0.75}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Modelo de IA"
                testID="c-model"
              >
                <View
                  style={[
                    styles.modelDot,
                    { backgroundColor: modelDotColor || colors.ink },
                  ]}
                />
                <Text style={[styles.modelText, { color: colors.ink }]} numberOfLines={1}>
                  {modelLabel}
                </Text>
                <ChevronDownSvgIcon size={13} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Linha 2: Input + #c-mic + slot dinâmico .wv <-> .send */}
          <View style={styles.crowBottom}>
            <TextInput
              ref={textInputRef}
              style={[styles.fieldInput, { color: colors.ink }]}
              placeholder={
                isRecording
                  ? 'Gravando áudio... toque para enviar'
                  : 'Pergunte ao Vito...'
              }
              placeholderTextColor={isRecording ? colors.red : colors.muted}
              value={inputText}
              onChangeText={updateInputText}
              multiline
              maxLength={1000}
              blurOnSubmit={false}
              returnKeyType="default"
            />

            {isRecording && onCancelRecording && (
              <TouchableOpacity
                style={[styles.circ, { backgroundColor: colors.redBg }]}
                onPress={onCancelRecording}
                activeOpacity={0.75}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Cancelar gravação"
              >
                <ProtoUiIcon name="delete-outline" size={18} color={colors.red} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.circ,
                { backgroundColor: isRecording ? colors.red : colors.btn },
              ]}
              onPress={onPressMic}
              activeOpacity={0.75}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel={isRecording ? 'Concluir gravação' : 'Gravar áudio'}
              testID="c-mic"
            >
              {isRecording ? (
                <ProtoUiIcon name="check" size={18} color="#ffffff" />
              ) : (
                <MicSvgIcon size={18} color={colors.ink} />
              )}
            </TouchableOpacity>

            {/* Slot dinâmico: Parar (loading) | Enviar (.send) | Voz (.wv) */}
            {loading ? (
              <TouchableOpacity
                style={[styles.circ, { backgroundColor: colors.red }]}
                onPress={() => onStop?.()}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Interromper geração"
              >
                <ProtoUiIcon name="stop" size={18} color="#ffffff" />
              </TouchableOpacity>
            ) : canSend ? (
              <Animated.View style={{ transform: [{ scale: sendPopAnim }] }}>
                <TouchableOpacity
                  style={[styles.circ, { backgroundColor: colors.ink }]}
                  onPress={handleTriggerSend}
                  activeOpacity={0.8}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Enviar"
                  testID="c-send"
                >
                  <SendUpSvgIcon size={18} color={colors.bg} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={[styles.circ, { backgroundColor: colors.ink }]}
                onPress={() => {
                  hapticFeedback.light();
                  onPressLiveVoice?.();
                }}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Conversar por voz"
                testID="c-voice"
              >
                <WaveSvgIcon size={17} color={colors.bg} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  dockWrapper: {
    paddingHorizontal: 16,
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
  cmp: {
    borderRadius: v5Radii.sheet,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  crowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    maxWidth: 170,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
  },
  modelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelText: {
    fontFamily: 'Geist',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  fieldInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    fontFamily: 'Geist',
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});
