import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { FocusMode, FOCUS_MODES } from '../../types/focus';

export interface FocusMenuModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFocus: FocusMode | null;
  onSelectFocus: (focus: FocusMode | null) => void;
}

export const FocusMenuModal: React.FC<FocusMenuModalProps> = ({
  visible,
  onClose,
  selectedFocus,
  onSelectFocus,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surfaceContainerLowest || (isDark ? '#14171C' : '#FFFFFF'),
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              {/* Indicador de arrasto */}
              <View style={styles.dragIndicatorWrapper}>
                <View style={[styles.dragIndicator, { backgroundColor: colors.outlineVariant }]} />
              </View>

              {/* Cabeçalho */}
              <View style={styles.header}>
                <View style={styles.headerTitles}>
                  <Text style={[styles.headerEyebrow, { color: colors.primary }]}>
                    FOCO DA IA
                  </Text>
                  <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
                    Priorizar Contexto
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
                    Direciona a cognição do Vito para atender com precisão máxima no módulo escolhido.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHigh }]}
                  onPress={onClose}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Fechar menu de foco"
                >
                  <MaterialIcons name="close" size={20} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              {/* Lista de Modos de Foco */}
              <ScrollView
                style={styles.modesList}
                contentContainerStyle={styles.modesListContent}
                showsVerticalScrollIndicator={false}
              >
                {FOCUS_MODES.map((mode) => {
                  const isSelected = selectedFocus?.id === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.modeItem,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 102, 241, 0.08)')
                            : colors.surfaceContainerLow || (isDark ? '#1A1E24' : '#F8F9FA'),
                          borderColor: isSelected
                            ? colors.primary
                            : (colors.outlineVariant || 'transparent'),
                        },
                      ]}
                      onPress={() => {
                        onSelectFocus(isSelected ? null : mode);
                        onClose();
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View
                        style={[
                          styles.modeIconWrapper,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={mode.iconName as any}
                          size={20}
                          color={isSelected ? '#FFFFFF' : colors.onSurfaceVariant}
                        />
                      </View>

                      <View style={styles.modeTextWrapper}>
                        <Text
                          style={[
                            styles.modeTitle,
                            {
                              color: isSelected ? colors.primary : colors.onSurface,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {mode.title}
                        </Text>
                        <Text
                          style={[styles.modeDescription, { color: colors.onSurfaceVariant }]}
                          numberOfLines={2}
                        >
                          {mode.description}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                          <MaterialIcons name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <MaterialIcons
                          name="chevron-right"
                          size={18}
                          color={colors.outline}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Opção para Limpar / Restaurar Foco Geral */}
                {selectedFocus && (
                  <TouchableOpacity
                    style={[
                      styles.clearButton,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                      },
                    ]}
                    onPress={() => {
                      onSelectFocus(null);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="restart-alt" size={18} color="#EF4444" />
                    <Text style={styles.clearButtonText}>Restaurar modo geral (sem filtro)</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitles: {
    flex: 1,
    paddingRight: 12,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modesList: {
    paddingHorizontal: 16,
  },
  modesListContent: {
    gap: 8,
    paddingBottom: 16,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modeIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  modeTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  modeDescription: {
    fontSize: 11,
    lineHeight: 15,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
