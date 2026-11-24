import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { PendingItem } from '../../../types';
import { formatScheduledDate } from '../../../utils/chatCards';
import { tabNavigationBus, chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';
import { PressableScale } from '../../../theme/vitoMotion';

interface PendingInlineCardProps {
  pending: PendingItem;
  onUndo?: () => void;
}

/**
 * Card in-chat de item pendente alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip amarelo/laranja 44x44px e ícone de inbox.
 * - Título em Inter 600 SemiBold e subtítulo com data agendada e categoria.
 * - Botões de ação em pílula abaixo do card: "Desfazer" (outline) e "Ver tarefas" (solid ink).
 */
export const PendingInlineCard: React.FC<PendingInlineCardProps> = ({ pending, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const dateLabel = formatScheduledDate(pending.scheduled_date);
  const subtitleText = `${dateLabel} · ${pending.category || 'Geral'}`;

  const handleUndo = () => {
    hapticFeedback.light();
    setUndone(true);
    if (onUndo) {
      onUndo();
    } else {
      chatPromptBus.notify(`Desfazer pendência "${pending.title}"`);
    }
  };

  const handleViewTasks = () => {
    hapticFeedback.selection();
    tabNavigationBus.notify('tasks');
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
        {/* Chip Amarelo/Laranja 40x40 */}
        <View style={[styles.chip, { backgroundColor: colors.orangeBg }]}>
          <ProtoUiIcon name="inbox" size={20} color={colors.orange} />
        </View>

        {/* Informações da Pendência */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={1}
          >
            {pending.title}
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
            accessibilityLabel="Desfazer pendência"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewTasks}
            accessibilityRole="button"
            accessibilityLabel="Ver tarefas"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver tarefas
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
