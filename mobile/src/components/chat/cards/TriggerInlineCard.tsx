import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Trigger } from '../../../types';
import { RadarIcon } from '../../login/DemoIcons';
import { tabNavigationBus, chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';

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
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
          undone && { opacity: 0.5 },
        ]}
      >
        {/* Chip Laranja 44x44 com RadarIcon */}
        <View style={[styles.chip, { backgroundColor: colors.orangeBg }]}>
          <RadarIcon color={colors.orange} size={22} />
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
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.ink }]}
            onPress={handleUndo}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Desfazer radar"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewRadars}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ver radares"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver radares
            </Text>
          </TouchableOpacity>
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
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
