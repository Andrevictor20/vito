import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, RadialGradient, Circle, Stop, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { VitoMascot } from '../components/common/VitoMascot';
import {
  ConversationState,
  formatVoiceDuration,
  getPrototypeStateColor,
  getPrototypeSpeakerLabel,
  getPrototypeHint,
  getStateLabel,
} from './voiceOverlayHelpers';
import { voiceFullscreenStyles as styles } from './voiceFullscreenStyles';
import type { ChatWhatsAppMessage } from '../types';

export interface VoiceFullscreenViewProps {
  state: ConversationState;
  transcript: string;
  audioLevel: number;
  durationSeconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  onSwitchToText: () => void;
  onTapOrb: () => void;
  whatsappCard?: ChatWhatsAppMessage | null;
  isSendingWhatsApp?: boolean;
  whatsAppSent?: boolean;
  onConfirmWhatsApp?: () => void;
  screenContext?: string;
  voice?: 'puck' | 'kore';
  onToggleVoice?: () => void;
}

export const VoiceFullscreenView: React.FC<VoiceFullscreenViewProps> = ({
  state,
  transcript,
  audioLevel,
  durationSeconds,
  isMuted,
  onToggleMute,
  onClose,
  onSwitchToText,
  onTapOrb,
  whatsappCard,
  isSendingWhatsApp = false,
  whatsAppSent = false,
  onConfirmWhatsApp,
  screenContext,
  voice = 'puck',
  onToggleVoice,
}) => {
  const { colors, isDark } = useTheme();
  const stateColor = isMuted ? colors.muted : getPrototypeStateColor(state);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: state === 'THINKING' ? 2200 : 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    const ringLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1Anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring1Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(ring2Anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    ringLoop.start();

    let bobLoop: Animated.CompositeAnimation | null = null;
    if (state === 'SPEAKING') {
      bobLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, {
            toValue: 1.05,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bobAnim, {
            toValue: 1.0,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      bobLoop.start();
    } else {
      bobAnim.setValue(1);
    }

    return () => {
      spinLoop.stop();
      ringLoop.stop();
      bobLoop?.stop();
    };
  }, [state, spinAnim, ring1Anim, ring2Anim, bobAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const haloScale = 0.82 + Math.min(Math.max(audioLevel, 0), 1) * 0.35;
  const haloOpacity = isMuted ? 0.2 : state === 'THINKING' ? 0.85 : 0.65;

  const ring1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.65] });
  const ring1Opacity = ring1Anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.35, 0] });

  const ring2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.65] });
  const ring2Opacity = ring2Anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.35, 0] });

  const eqDelays = [0.1, 0.45, 0.25, 0.6, 0.3, 0.7, 0.15];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0D0F10' : '#FFFFFF' }]}>
      {/* Top Bar (.vtop) */}
      <View style={styles.vtop}>
        <TouchableOpacity
          style={[styles.minBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityLabel="Minimizar conversa por voz"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 9l6 6 6-6"
              stroke={colors.ink}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <View style={styles.vctx}>
          <Text style={[styles.vctxTitle, { color: colors.ink }]}>Conversa por voz</Text>
          <Text style={[styles.vctxSub, { color: colors.muted }]}>
            {screenContext ? `Você está em ${screenContext}` : 'Você está no Chat'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.vtime, { color: colors.muted }]}>
            {formatVoiceDuration(durationSeconds)}
          </Text>
          {onToggleVoice && (
            <TouchableOpacity
              onPress={onToggleVoice}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: colors.surf,
                borderColor: colors.line,
                borderWidth: 1,
              }}
              accessibilityLabel={`Alternar voz. Atual: ${voice === 'kore' ? 'Feminina' : 'Masculina'}`}
            >
              <Text style={{ fontSize: 11 }}>{voice === 'kore' ? '👩' : '👨'}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.ink }}>
                {voice === 'kore' ? 'Feminina' : 'Masculina'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Palco Central (.vstage) */}
      <View style={styles.stageSection}>
        <View style={styles.vstage}>
          {/* Halo Gradiente Dinâmico */}
          <Animated.View
            style={[
              styles.haloContainer,
              {
                opacity: haloOpacity,
                transform: [{ scale: haloScale }, { rotate: spinInterpolate }],
              },
            ]}
          >
            <Svg width={220} height={220} viewBox="0 0 220 220">
              <Defs>
                <RadialGradient id="haloGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={stateColor} stopOpacity="0.8" />
                  <Stop offset="45%" stopColor={state === 'THINKING' ? '#F59E0B' : '#3B82F6'} stopOpacity="0.5" />
                  <Stop offset="75%" stopColor="#8B5CF6" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={stateColor} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={110} cy={110} r={105} fill="url(#haloGrad)" />
            </Svg>
          </Animated.View>

          {/* Anéis pulsantes */}
          {!isMuted && (
            <>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    borderColor: stateColor,
                    opacity: ring1Opacity,
                    transform: [{ scale: ring1Scale }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    borderColor: stateColor,
                    opacity: ring2Opacity,
                    transform: [{ scale: ring2Scale }],
                  },
                ]}
              />
            </>
          )}

          {/* Orbe Central (.orb) com VitoMascot */}
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onTapOrb}
            accessibilityLabel="Tocar no Vito para interromper fala"
          >
            <Animated.View
              style={[
                styles.orb,
                {
                  backgroundColor: colors.bg,
                  borderColor: stateColor,
                  shadowColor: stateColor,
                  transform: [{ scale: bobAnim }],
                },
              ]}
            >
              <VitoMascot
                size={84}
                animated
                state={state === 'THINKING' ? 'thinking' : 'idle'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Equalizador Harmônico de 7 Barras (.eq) */}
        <View style={styles.eq}>
          {eqDelays.map((delay, idx) => {
            const barH = isMuted
              ? 5
              : state === 'THINKING'
              ? 8 + Math.sin(delay * 10) * 4
              : Math.max(5, Math.min(22, 5 + audioLevel * 17 * (1 - delay * 0.4)));
            return (
              <View
                key={idx}
                style={[
                  styles.eqBar,
                  {
                    height: barH,
                    backgroundColor: stateColor,
                    opacity: isMuted ? 0.35 : 0.9,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Estado da Conversa (.vstate) */}
        <Text style={[styles.vstate, { color: stateColor }]}>
          {isMuted ? 'Microfone mudo' : getStateLabel(state)}
        </Text>

        {/* Dica de Uso (.vhint) */}
        <Text style={[styles.vhint, { color: colors.muted }]}>
          {getPrototypeHint(state, isMuted)}
        </Text>
      </View>

      {/* Legenda e Transcrição (.vcap) */}
      <View style={styles.vcap}>
        <Text style={[styles.vcapWho, { color: colors.muted }]}>
          {getPrototypeSpeakerLabel(state)}
        </Text>
        <Text
          style={[styles.vcapText, { color: colors.ink }]}
          numberOfLines={4}
          ellipsizeMode="tail"
        >
          {transcript}
        </Text>

        {whatsappCard && (
          <View style={[styles.whatsAppCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            <View style={styles.whatsAppLeft}>
              <Text style={styles.whatsAppIcon}>💬</Text>
              <Text style={[styles.whatsAppText, { color: colors.ink }]} numberOfLines={1}>
                {whatsappCard.recipient_name || whatsappCard.recipient_phone || 'WhatsApp'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.whatsAppBtn,
                (isSendingWhatsApp || whatsAppSent) && { opacity: 0.6 },
              ]}
              onPress={onConfirmWhatsApp}
              disabled={isSendingWhatsApp || whatsAppSent}
              activeOpacity={0.8}
            >
              {isSendingWhatsApp ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.whatsAppBtnText}>
                  {whatsAppSent ? 'Enviado ✓' : 'Confirmar Envio'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Controles Inferiores (.vctl) */}
      <View style={styles.vctl}>
        {/* Botão Mudo */}
        <View style={styles.vbCol}>
          <TouchableOpacity
            style={[
              styles.vbCircle,
              {
                backgroundColor: isMuted ? colors.ink : colors.surf,
                borderColor: colors.line,
              },
            ]}
            onPress={onToggleMute}
            activeOpacity={0.7}
            accessibilityLabel={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              {isMuted ? (
                <Path
                  d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M19 10v2a7 7 0 0 1-.5 2.6M12 19v4M8 23h8"
                  stroke={colors.bg}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <>
                  <Rect x={9} y={2} width={6} height={12} rx={3} stroke={colors.ink} strokeWidth={2.2} />
                  <Path d="M5 10a7 7 0 0 0 14 0M12 18v4M8 22h8" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" />
                </>
              )}
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.vbLabel, { color: colors.muted }]}>
            {isMuted ? 'Mudo' : 'Microfone'}
          </Text>
        </View>

        {/* Botão Encerrar */}
        <View style={styles.vbCol}>
          <TouchableOpacity
            style={styles.vbEndCircle}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityLabel="Encerrar conversa por voz"
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke="#FFFFFF"
                strokeWidth={2.8}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.vbLabel, { color: colors.red, fontWeight: '700' }]}>
            Encerrar
          </Text>
        </View>

        {/* Botão Texto */}
        <View style={styles.vbCol}>
          <TouchableOpacity
            style={[styles.vbCircle, { backgroundColor: colors.surf, borderColor: colors.line }]}
            onPress={onSwitchToText}
            activeOpacity={0.7}
            accessibilityLabel="Voltar para digitação de texto"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x={2} y={5} width={20} height={14} rx={3} stroke={colors.ink} strokeWidth={2.2} />
              <Path
                d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"
                stroke={colors.ink}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.vbLabel, { color: colors.muted }]}>Texto</Text>
        </View>
      </View>
    </View>
  );
};
