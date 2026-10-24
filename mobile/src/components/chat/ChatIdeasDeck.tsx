import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import {
  CalIcon,
  MailIcon,
  RadarIcon,
  CheckCircleIcon,
  WhatsAppGlyph,
} from '../login/DemoIcons';

export interface IdeaCard {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  prompt: string;
  layout: 'agenda' | 'gmail' | 'whatsapp' | 'radar' | 'task';
}

const IDEA_CARDS: IdeaCard[] = [
  {
    id: 'agenda',
    tag: 'Agenda',
    title: 'Organizar a semana',
    subtitle: 'Revisa horários, eventos e compromissos',
    prompt: 'Organiza a minha agenda da semana',
    layout: 'agenda',
  },
  {
    id: 'emails',
    tag: 'Gmail',
    title: 'Resumo dos e-mails',
    subtitle: 'Destaca mensagens urgentes e pendências',
    prompt: 'Resume os meus e-mails importantes de hoje',
    layout: 'gmail',
  },
  {
    id: 'whatsapp',
    tag: 'WhatsApp',
    title: 'Responder mensagens',
    subtitle: 'Rascunha respostas quando você estiver ocupado',
    prompt: 'Responde as mensagens do WhatsApp por mim quando eu estiver ocupado',
    layout: 'whatsapp',
  },
  {
    id: 'flight',
    tag: 'Radar',
    title: 'Voo para o Rio',
    subtitle: 'Alerta quando o preço baixar de R$ 600',
    prompt: 'Me avisa quando o voo para o Rio baixar de R$ 600',
    layout: 'radar',
  },
  {
    id: 'bills',
    tag: 'Tarefas',
    title: 'Contas e boletos',
    subtitle: 'Lembrar de pagamentos antes de vencer',
    prompt: 'Lembra das minhas contas e boletos antes de vencer',
    layout: 'task',
  },
  {
    id: 'schedule_msg',
    tag: 'WhatsApp',
    title: 'Agendar mensagem',
    subtitle: 'Envio programado para amanhã às 09h',
    prompt: 'Agenda uma mensagem de WhatsApp para amanhã às 9h',
    layout: 'whatsapp',
  },
  {
    id: 'briefing',
    tag: 'Agenda',
    title: 'Resumo executivo',
    subtitle: 'Síntese diária de foco e prioridades',
    prompt: 'Manda um resumo executivo do meu dia toda manhã',
    layout: 'agenda',
  },
];

interface ChatIdeasDeckProps {
  onUseIdea: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatIdeasDeck: React.FC<ChatIdeasDeckProps> = ({ onUseIdea, disabled }) => {
  const { colors, isDark } = useTheme();
  const [cur, setCur] = useState(0);
  const n = IDEA_CARDS.length;

  const goNext = () => {
    hapticFeedback.selection();
    setCur((prev) => (prev + 1) % n);
  };

  const goPrev = () => {
    hapticFeedback.selection();
    setCur((prev) => (prev - 1 + n) % n);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
        if (gestureState.dx < -30) {
          goNext();
        } else if (gestureState.dx > 30) {
          goPrev();
        }
      },
    })
  ).current;

  const getChipAndTag = (layout: IdeaCard['layout']) => {
    switch (layout) {
      case 'agenda':
        return {
          chipBg: colors.blueBg,
          icon: <CalIcon color={colors.blue} />,
          tagBg: colors.blueBg,
          tagText: colors.blue,
        };
      case 'gmail':
        return {
          chipBg: colors.redBg,
          icon: <MailIcon color={colors.red} size={20} />,
          tagBg: colors.redBg,
          tagText: colors.red,
        };
      case 'whatsapp':
        return {
          chipBg: colors.greenBg,
          icon: <WhatsAppGlyph color={colors.acc} size={22} />,
          tagBg: colors.greenBg,
          tagText: colors.acc,
        };
      case 'radar':
        return {
          chipBg: colors.orangeBg,
          icon: <RadarIcon color={colors.orange} />,
          tagBg: colors.orangeBg,
          tagText: colors.orange,
        };
      case 'task':
      default:
        return {
          chipBg: colors.purpleBg,
          icon: <CheckCircleIcon color={colors.purple} />,
          tagBg: colors.purpleBg,
          tagText: colors.purple,
        };
    }
  };

  const nextIdx = (cur + 1) % n;
  const prevIdx = (cur - 1 + n) % n;

  return (
    <View style={styles.container}>
      {/* Deck 3D Carousel */}
      <View style={styles.deckViewport} {...panResponder.panHandlers}>
        {IDEA_CARDS.map((card, i) => {
          const isCurrent = i === cur;
          const isNext = i === nextIdx;
          const isPrev = i === prevIdx;

          if (!isCurrent && !isNext && !isPrev) {
            return null;
          }

          const transform = isCurrent
            ? [{ scale: 1 }]
            : isNext
            ? [{ translateX: 48 }, { rotate: '5deg' }, { scale: 0.92 }]
            : [{ translateX: -48 }, { rotate: '-5deg' }, { scale: 0.92 }];

          const zIndex = isCurrent ? 3 : 2;
          const opacity = isCurrent ? 1 : 0.78;
          const visual = getChipAndTag(card.layout);

          return (
            <View
              key={card.id}
              style={[
                styles.zc,
                {
                  backgroundColor: colors.bg,
                  borderColor: isCurrent ? colors.line : colors.line,
                  borderWidth: 1,
                  transform,
                  zIndex,
                  opacity,
                },
                isCurrent && styles.zcCurrentShadow,
              ]}
            >
              {/* Top Row: Chip Arredondado 38x38px com Ícone Vetorial + Tag Pílula (SEM emoji, SEM compartilhar) */}
              <View style={styles.zcTop}>
                <View style={[styles.chip, { backgroundColor: visual.chipBg }]}>
                  {visual.icon}
                </View>
                <View style={[styles.tag, { backgroundColor: visual.tagBg }]}>
                  <Text style={[styles.tagText, { color: visual.tagText }]}>
                    {card.tag}
                  </Text>
                </View>
              </View>

              {/* Middle: Título e Descrição no estilo dos Action Cards */}
              <View style={styles.zcMiddle}>
                <Text
                  style={[styles.zcTitle, { color: colors.ink }]}
                  numberOfLines={2}
                >
                  {card.title}
                </Text>
                <Text
                  style={[styles.zcSubtitle, { color: colors.muted }]}
                  numberOfLines={2}
                >
                  {card.subtitle}
                </Text>
              </View>

              {/* Bottom: Botão Pílula Usar */}
              <View style={styles.zcBottom}>
                <TouchableOpacity
                  style={[styles.useButton, { backgroundColor: colors.ink }]}
                  onPress={() => {
                    hapticFeedback.medium();
                    onUseIdea(card.prompt);
                  }}
                  disabled={disabled}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.useButtonText, { color: colors.bg }]}>
                    Usar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Botão Pílula "Ver mais ideias" (.moreb) */}
      <TouchableOpacity
        style={[styles.moreButton, { backgroundColor: colors.surf, borderColor: colors.line }]}
        onPress={goNext}
        activeOpacity={0.7}
      >
        <Text style={[styles.moreButtonText, { color: colors.ink }]}>
          Ver mais ideias
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  deckViewport: {
    width: 280,
    height: 242,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zc: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
  },
  zcCurrentShadow: {
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  zcTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    fontWeight: '600',
  },
  zcMiddle: {
    marginTop: 6,
    marginBottom: 4,
  },
  zcTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  zcSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
  zcBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  useButton: {
    height: 34,
    paddingHorizontal: 20,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  moreButton: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
