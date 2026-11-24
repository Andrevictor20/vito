import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { Trigger } from '../../../../types';
import { RadarIcon } from '../../../auth/demo/DemoIcons';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { PressableScale } from '../../../../theme/vitoMotion';

interface TriggerInlineCardProps {
  trigger: Trigger;
  onUndo?: () => void;
}

/**
 * Card in-chat de criação de radar alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip laranja 44x44px e ícone de radar.
 * - Título em Inter 600 SemiBold e subtítulo contextual da busca ou alerta.
 * - Botões de ação em pílula abaixo do card: "Desfazer" (outline) e "Ver radares" (solid ink).
 */
export const TriggerInlineCard: React.FC<TriggerInlineCardProps> = ({ trigger, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const subtitleText = trigger.query
    ? `${trigger.query} · Radar ativo`
    : 'Monitorando diariamente · Alerta ativo';

  const handleUndo = () => {
    hapticFeedback.light();
    setUndone(true);
    if (onUndo) {
      onUndo();
    } else {
      chatPromptBus.notify(`Desfazer radar "${trigger.title}"`);
    }
  };

  const handleViewRadars = () => {
    hapticFeedback.selection();
    tabNavigationBus.notify('triggers');
  };

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surf },
          undone && { opacity: 0.5 },
        ]}
      >
        {/* Chip Laranja 40x40 com RadarIcon */}
        <View style={[styles.chip, { backgroundColor: colors.orangeBg }]}>
          <RadarIcon color={colors.orange} size={20} />
        </View>

        {/* Informações do Radar */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={2}
          >
            {trigger.title}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Botões de Ação Abaixo do Card */}
      {!undone && (
        <View style={styles.actionsRow}>
          <PressableScale
            style={[styles.btnOutline, { backgroundColor: colors.surf }]}
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Desfazer bot"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewRadars}
            accessibilityRole="button"
            accessibilityLabel="Ver bots"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver bots
            </Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: '100%',
  },
  card: {
    borderRadius: 22,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
});
