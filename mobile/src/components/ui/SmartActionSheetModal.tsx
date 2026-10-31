import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { pagerSwipeLockBus } from '../../services/dataSync';
import { SmartActionItem } from '../../utils/smartActionBuilders';

export interface SmartActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  tag?: string;
  tagColor?: string;
  tagBg?: string;
  title: string;
  subtitle?: string;
  actions: SmartActionItem[];
  cancelLabel?: string;
}

export const SmartActionSheetModal: React.FC<SmartActionSheetModalProps> = ({
  visible,
  onClose,
  tag,
  tagColor,
  tagBg,
  title,
  subtitle,
  actions,
  cancelLabel = 'Voltar',
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // Garante que o gesto de voltar do Android (físico ou deslizamento de borda) feche o modal
  useEffect(() => {
    if (!visible) return;
    pagerSwipeLockBus.notify(true);

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => {
      pagerSwipeLockBus.notify(false);
      backSubscription.remove();
    };
  }, [visible, onClose]);

  const handleActionPress = (action: SmartActionItem) => {
    hapticFeedback.selection();
    onClose();
    // Executa a ação após pequeno tick para dismiss suave
    setTimeout(() => {
      action.onPress();
    }, 60);
  };

  const handleCancel = () => {
    hapticFeedback.light();
    onClose();
  };

  // Cores dinâmicas para o tema claro / escuro
  const sheetBg = colors.surface;
  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.40)';
  const borderColor = colors.outlineVariant || (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');
  const handleColor = isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.16)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Scrim / Backdrop clicável */}
        <TouchableWithoutFeedback onPress={handleCancel} accessibilityLabel="Fechar janela">
          <View style={[styles.overlay, { backgroundColor: overlayBg }]} />
        </TouchableWithoutFeedback>

        {/* Bottom Sheet Container */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              borderTopColor: borderColor,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          {/* Pílula de puxar */}
          <View style={[styles.handle, { backgroundColor: handleColor }]} />

          {/* Cabeçalho Contextual */}
          <View style={styles.header}>
            <View style={styles.headerMain}>
              {tag ? (
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor:
                        tagBg ||
                        (isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(5, 150, 105, 0.10)'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color:
                          tagColor ||
                          (isDark ? colors.accents.emerald : colors.accents.emeraldText),
                      },
                    ]}
                  >
                    {tag.toUpperCase()}
                  </Text>
                </View>
              ) : null}

              <Text
                style={[styles.title, { color: colors.onSurface }]}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {title}
              </Text>

              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleCancel}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Lista de Ações Inteligentes */}
          <ScrollView
            style={styles.actionsScroll}
            contentContainerStyle={styles.actionsContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {actions.map((act) => {
              const isAi = act.variant === 'ai';
              const isDestructive = act.variant === 'destructive';
              const isPrimary = act.variant === 'primary';

              let cardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
              let cardBorder = borderColor;
              let iconBg = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
              let iconColor = colors.onSurfaceVariant;
              let titleColor = colors.onSurface;

              if (isAi) {
                cardBg = isDark ? 'rgba(52, 211, 153, 0.07)' : 'rgba(5, 150, 105, 0.05)';
                cardBorder = isDark ? 'rgba(52, 211, 153, 0.28)' : 'rgba(5, 150, 105, 0.22)';
                iconBg = isDark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(5, 150, 105, 0.12)';
                iconColor = isDark ? '#34D399' : '#059669';
              } else if (isDestructive) {
                cardBg = isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(225, 29, 72, 0.04)';
                cardBorder = isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(225, 29, 72, 0.20)';
                iconBg = isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(225, 29, 72, 0.10)';
                iconColor = isDark ? '#F87171' : '#E11D48';
                titleColor = isDark ? '#FCA5A5' : '#BE123C';
              } else if (isPrimary) {
                cardBg = isDark ? 'rgba(56, 189, 248, 0.06)' : 'rgba(2, 132, 199, 0.04)';
                cardBorder = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.18)';
                iconBg = isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(2, 132, 199, 0.10)';
                iconColor = isDark ? '#38BDF8' : '#0284C7';
              }

              return (
                <TouchableOpacity
                  key={act.id}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleActionPress(act)}
                  accessibilityRole="button"
                  accessibilityLabel={`${act.title}${act.subtitle ? `, ${act.subtitle}` : ''}`}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
                    <MaterialIcons
                      name={act.icon as keyof typeof MaterialIcons.glyphMap}
                      size={20}
                      color={iconColor}
                    />
                  </View>

                  <View style={styles.actionTextWrap}>
                    <View style={styles.actionTitleRow}>
                      <Text style={[styles.actionTitle, { color: titleColor }]}>
                        {act.title}
                      </Text>
                      {act.badge ? (
                        <View
                          style={[
                            styles.actionBadge,
                            {
                              backgroundColor: isDark
                                ? 'rgba(52, 211, 153, 0.22)'
                                : 'rgba(5, 150, 105, 0.14)',
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="auto-awesome"
                            size={10}
                            color={isDark ? '#34D399' : '#059669'}
                            style={styles.actionBadgeIcon}
                          />
                          <Text
                            style={[
                              styles.actionBadgeText,
                              { color: isDark ? '#34D399' : '#059669' },
                            ]}
                          >
                            {act.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {act.subtitle ? (
                      <Text
                        style={[styles.actionSubtitle, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {act.subtitle}
                      </Text>
                    ) : null}
                  </View>

                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={colors.onSurfaceVariant}
                    style={styles.chevron}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Botão de Cancelar / Voltar */}
          <TouchableOpacity
            style={[
              styles.cancelButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                borderColor,
              },
            ]}
            activeOpacity={0.7}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={[styles.cancelButtonText, { color: colors.onSurface }]}>
              {cancelLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    marginBottom: 12,
  },
  headerMain: {
    flex: 1,
    paddingRight: 12,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionsScroll: {
    maxHeight: 380,
  },
  actionsContent: {
    paddingVertical: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    lineHeight: 19,
  },
  actionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  actionBadgeIcon: {
    marginTop: 0.5,
  },
  actionBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  chevron: {
    opacity: 0.45,
    marginLeft: 6,
  },
  cancelButton: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
