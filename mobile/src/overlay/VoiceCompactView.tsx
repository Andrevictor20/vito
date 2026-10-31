import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VitoMascot } from '../components/common/VitoMascot';
import {
  ConversationState,
  getPrototypeStateColor,
  getStateLabel,
  formatVoiceDuration,
} from './voiceOverlayHelpers';
import { voiceOverlayStyles as styles } from './vitoVoiceOverlayStyles';
import type { ChatWhatsAppMessage } from '../types';

export interface VoiceCompactViewProps {
  state: ConversationState;
  transcript: string;
  barHeights: number[];
  durationSeconds: number;
  triggerSource: string;
  slideAnim: Animated.Value;
  fadeAnim: Animated.Value;
  onClose: () => void;
  whatsappCard?: ChatWhatsAppMessage | null;
  isSendingWhatsApp?: boolean;
  whatsAppSent?: boolean;
  onConfirmWhatsApp?: () => void;
}

export const VoiceCompactView: React.FC<VoiceCompactViewProps> = ({
  state,
  transcript,
  barHeights,
  durationSeconds,
  triggerSource,
  slideAnim,
  fadeAnim,
  onClose,
  whatsappCard,
  isSendingWhatsApp = false,
  whatsAppSent = false,
  onConfirmWhatsApp,
}) => {
  const stateColor = getPrototypeStateColor(state);

  return (
    <View style={styles.container}>
      {/* Backdrop transparente com toque para fechar */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Fechar assistente flutuante"
      />

      {/* Vinheta ultra-translúcida na base para legibilidade sem cobrir a tela */}
      <View pointerEvents="none" style={styles.vignetteWrapper}>
        <Svg width="100%" height={200} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="compactVignette" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0B0D13" stopOpacity="0" />
              <Stop offset="50%" stopColor="#0B0D13" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#0B0D13" stopOpacity="0.75" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={200} fill="url(#compactVignette)" />
        </Svg>
      </View>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Card Satélite do WhatsApp (se houver mensagem pronta) */}
        {whatsappCard && (
          <View style={styles.whatsAppSatellite}>
            <View style={styles.whatsAppSatelliteLeft}>
              <Text style={styles.whatsAppSatelliteIcon}>💬</Text>
              <Text style={styles.whatsAppSatelliteText} numberOfLines={1}>
                {whatsappCard.recipient_name || whatsappCard.recipient_phone || 'WhatsApp'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.whatsAppSendBtn,
                (isSendingWhatsApp || whatsAppSent) && styles.whatsAppSendBtnDisabled,
              ]}
              onPress={onConfirmWhatsApp}
              disabled={isSendingWhatsApp || whatsAppSent}
              activeOpacity={0.8}
            >
              {isSendingWhatsApp ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.whatsAppSendBtnText}>
                  {whatsAppSent ? 'Enviado ✓' : 'Enviar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Chip Translúcido de Transcrição */}
        <View style={styles.transcriptChip}>
          <View style={styles.transcriptChipHeader}>
            <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
            <Text style={[styles.stateLabel, { color: stateColor }]}>
              {getStateLabel(state)}
            </Text>
            <Text style={styles.timerCompactText}>
              {formatVoiceDuration(durationSeconds)}
            </Text>
          </View>
          <Text style={styles.transcriptText} numberOfLines={3}>
            {transcript}
          </Text>
        </View>

        {/* Pílula Flutuante M3 (58dp) com Waveform Harmônica */}
        <View
          style={[
            styles.pill,
            { borderColor: state === 'LISTENING' ? 'rgba(255,255,255,0.08)' : stateColor },
          ]}
        >
          {/* Lado Esquerdo: Mini Mascote Vito e Identificação */}
          <View style={styles.pillLeft}>
            <View style={[styles.miniOrbWrapper, { borderColor: stateColor }]}>
              <VitoMascot
                size={22}
                animated
                state={state === 'THINKING' ? 'thinking' : 'idle'}
              />
            </View>
            <Text style={styles.pillBadgeText}>
              {triggerSource === 'DEFAULT_ASSISTANT' ? 'Assistente' : 'Vito'}
            </Text>
          </View>

          {/* Centro: Visualizador de Ondas de 13 Barras */}
          <View style={styles.waveformContainer}>
            {barHeights.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: h,
                    backgroundColor: stateColor,
                  },
                ]}
              />
            ))}
          </View>

          {/* Lado Direito: Fechar */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Fechar assistente"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};
