import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { VitoMascot } from '../components/common/VitoMascot';
import {
  ConversationState,
  OverlayActionCardData,
  OverlayActionKind,
  getOverlayTheme,
  getCompactStateAccentColor,
  getCompactStateCaption,
  splitReplyWordsForHighlight,
} from './voiceOverlayHelpers';
import {
  ActionCategoryIcon,
  MulticolorGradientSvg,
  EdgeGlowSvg,
  EyeContextIcon,
  MicToggleIcon,
  CloseXIcon,
} from './VoiceCompactIcons';
import { voiceOverlayStyles as styles } from './vitoVoiceOverlayStyles';
import type { ChatWhatsAppMessage } from '../types';

export interface VoiceCompactViewProps {
  state: ConversationState;
  transcript: string;
  userTranscript?: string;
  replyText?: string;
  highlightedWordCount?: number;
  barHeights5: number[];
  isMuted: boolean;
  screenContextLabel?: string;
  screenContextVisible?: boolean;
  suggestions?: string[];
  actionCard?: OverlayActionCardData | null;
  slideAnim: Animated.Value;
  fadeAnim: Animated.Value;
  onClose: () => void;
  onToggleMute: () => void;
  onTapAvatar: () => void;
  onDismissScreenContext?: () => void;
  onSelectSuggestion?: (prompt: string) => void;
  onOpenInVito?: () => void;
  onUndoAction?: () => void;
  onExpandFromMini?: () => void;
  whatsappCard?: ChatWhatsAppMessage | null;
  isSendingWhatsApp?: boolean;
  whatsAppSent?: boolean;
  onConfirmWhatsApp?: () => void;
}

const DEFAULT_SUGGESTIONS = [
  'O que eu tenho hoje?',
  'Reserva duas horas de foco à tarde',
  'Resume meu dia',
];

export const VoiceCompactView: React.FC<VoiceCompactViewProps> = ({
  state,
  transcript,
  userTranscript = '',
  replyText = '',
  highlightedWordCount = 999,
  barHeights5,
  isMuted,
  screenContextLabel = 'Vendo esta tela',
  screenContextVisible = false,
  suggestions = DEFAULT_SUGGESTIONS,
  actionCard,
  slideAnim,
  fadeAnim,
  onClose,
  onToggleMute,
  onTapAvatar,
  onDismissScreenContext,
  onSelectSuggestion,
  onOpenInVito,
  onUndoAction,
  onExpandFromMini,
  whatsappCard,
  isSendingWhatsApp = false,
  whatsAppSent = false,
  onConfirmWhatsApp,
}) => {
  const systemScheme = useColorScheme();
  let isDarkTheme = systemScheme === 'dark';
  try {
    isDarkTheme = useTheme().isDark;
  } catch {
    // Usa o esquema do sistema como fallback
  }

  const theme = getOverlayTheme(isDarkTheme ? 'dark' : 'light');
  const accentColor = getCompactStateAccentColor(state, isMuted, theme);
  const caption = getCompactStateCaption(
    state,
    isMuted,
    state === 'LISTENING' || state === 'THINKING' ? userTranscript || transcript : transcript
  );

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: state === 'THINKING' ? 2200 : 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [state, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const edgeOpacity = isMuted
    ? 0
    : state === 'THINKING'
      ? 0.72
      : state === 'LISTENING' || state === 'SPEAKING'
        ? 0.48
        : state === 'IDLE'
          ? 0.18
          : 0;

  const words = splitReplyWordsForHighlight(replyText);
  const showResponseCard =
    (state === 'SPEAKING' || state === 'IDLE') &&
    (words.length > 0 || Boolean(actionCard) || Boolean(whatsappCard));
  const showSuggestions =
    !showResponseCard &&
    !isMuted &&
    (state === 'IDLE' || (state === 'LISTENING' && !userTranscript)) &&
    suggestions.length > 0;

  const getActionTint = (kind: OverlayActionKind) => {
    switch (kind) {
      case 'cal':
        return { bg: 'rgba(43, 127, 212, 0.14)', fg: theme.blue };
      case 'check':
        return { bg: 'rgba(122, 79, 224, 0.14)', fg: theme.purple };
      case 'wa':
        return { bg: 'rgba(11, 154, 95, 0.14)', fg: theme.acc };
      case 'coin':
      default:
        return { bg: 'rgba(168, 113, 10, 0.15)', fg: theme.fin };
    }
  };

  if (state === 'MINI') {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.miniBubbleOuter}
          activeOpacity={0.85}
          onPress={onExpandFromMini || onTapAvatar}
          accessibilityLabel="Expandir Vito"
        >
          <Animated.View style={[styles.pillGradientBg, { transform: [{ rotate: spinInterpolate }] }]}>
            <MulticolorGradientSvg id="miniGrad" theme={theme} />
          </Animated.View>
          <View style={[styles.miniBubbleInner, { backgroundColor: theme.ov }]}>
            <VitoMascot size={26} animated state="idle" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Fechar modo conversa fora do app"
      />

      <View pointerEvents="none" style={[styles.edgeGlowWrapper, { opacity: edgeOpacity }]}>
        <EdgeGlowSvg theme={theme} accentColor={accentColor} />
      </View>

      <Animated.View
        style={[
          styles.overlayDock,
          { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
        ]}
      >
        {showSuggestions && (
          <View style={styles.suggestionRow}>
            {suggestions.map((promptText, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.suggestionChip, { backgroundColor: theme.ov, borderColor: theme.line }]}
                activeOpacity={0.8}
                onPress={() => onSelectSuggestion?.(promptText)}
              >
                <Text style={[styles.suggestionChipText, { color: theme.ink }]}>{promptText}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showResponseCard && (
          <View style={[styles.responseCard, { backgroundColor: theme.ov, borderColor: theme.line }]}>
            {screenContextVisible && (
              <View style={[styles.contextBadge, { backgroundColor: theme.surf, borderColor: theme.line }]}>
                <EyeContextIcon color={theme.muted} />
                <Text style={[styles.contextBadgeText, { color: theme.muted }]}>{screenContextLabel}</Text>
                {onDismissScreenContext && (
                  <TouchableOpacity
                    style={styles.contextCloseBtn}
                    onPress={onDismissScreenContext}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Não compartilhar esta tela"
                  >
                    <Text style={[styles.contextCloseText, { color: theme.muted }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {words.length > 0 && (
              <Text style={styles.replyWordsText}>
                {words.map((word, index) => (
                  <Text
                    key={`${word}-${index}`}
                    style={{ color: index < highlightedWordCount ? theme.ink : theme.muted }}
                  >
                    {index === 0 ? word : ` ${word}`}
                  </Text>
                ))}
              </Text>
            )}

            {actionCard && (
              <View style={[styles.actionCard, { backgroundColor: theme.bg, borderColor: theme.line }]}>
                <View style={[styles.actionIconBox, { backgroundColor: getActionTint(actionCard.kind).bg }]}>
                  <ActionCategoryIcon kind={actionCard.kind} color={getActionTint(actionCard.kind).fg} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: theme.ink }]} numberOfLines={1}>
                    {actionCard.title}
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: theme.muted }]} numberOfLines={2}>
                    {actionCard.subtitle}
                  </Text>
                </View>
              </View>
            )}

            {(actionCard || whatsappCard) && (
              <View style={styles.actionButtonsRow}>
                {actionCard?.secondaryLabel && onUndoAction && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: theme.ink, backgroundColor: 'transparent' }]}
                    onPress={onUndoAction}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.ink }]}>{actionCard.secondaryLabel}</Text>
                  </TouchableOpacity>
                )}

                {whatsappCard ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: theme.ink, backgroundColor: theme.ink }]}
                    onPress={onConfirmWhatsApp}
                    disabled={isSendingWhatsApp || whatsAppSent}
                    activeOpacity={0.8}
                  >
                    {isSendingWhatsApp ? (
                      <ActivityIndicator size="small" color={theme.bg} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: theme.bg }]}>
                        {whatsAppSent ? 'Enviado ✓' : 'Enviar no WhatsApp'}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  onOpenInVito && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: theme.ink, backgroundColor: theme.ink }]}
                      onPress={onOpenInVito}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.actionBtnText, { color: theme.bg }]}>
                        {actionCard?.primaryLabel || 'Abrir no Vito'}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.pillBorderWrapper}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pillGradientBg,
              {
                opacity: isMuted ? 0.25 : state === 'IDLE' ? 0.45 : 0.92,
                transform: [{ rotate: spinInterpolate }],
              },
            ]}
          >
            <MulticolorGradientSvg id="pillBorderGrad" theme={theme} />
          </Animated.View>

          <View style={[styles.pillInner, { backgroundColor: theme.ov }]}>
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: theme.bg, borderColor: theme.line }]}
              onPress={onTapAvatar}
              activeOpacity={0.78}
              accessibilityLabel="Avatar do Vito"
            >
              <VitoMascot size={26} animated={!isMuted} state={state === 'THINKING' ? 'thinking' : 'idle'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.pillCaption} activeOpacity={0.85} onPress={onTapAvatar}>
              <Text style={[styles.pillCaptionSmall, { color: theme.muted }]} numberOfLines={1}>
                {caption.label}
              </Text>
              <Text style={[styles.pillCaptionMain, { color: theme.ink }]} numberOfLines={1}>
                {caption.text}
              </Text>
            </TouchableOpacity>

            <View style={styles.equalizer5Row}>
              {barHeights5.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.equalizer5Bar,
                    {
                      height: h,
                      backgroundColor: accentColor,
                      opacity: isMuted || state === 'IDLE' ? 0.35 : 0.9,
                    },
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.pillCircleBtn, { backgroundColor: isMuted ? theme.ink : theme.surf }]}
              onPress={onToggleMute}
              activeOpacity={0.75}
              accessibilityLabel={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
            >
              <MicToggleIcon isMuted={isMuted} color={isMuted ? theme.bg : theme.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pillCircleBtn, { backgroundColor: theme.surf }]}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityLabel="Fechar"
            >
              <CloseXIcon color={theme.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};
