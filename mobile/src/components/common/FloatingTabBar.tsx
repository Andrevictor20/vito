import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface FloatingTabBarProps {
  activeTab: 'chat' | 'calendar';
  onSelectTab: (tab: 'chat' | 'calendar') => void;
  visible?: boolean;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onSelectTab,
  visible = true,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.navBar,
        {
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderTopColor: colors.outlineVariant,
        },
      ]}
      accessibilityRole="tablist"
    >
      {/* Item 1: Chat IA */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectTab('chat')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'chat' }}
        accessibilityLabel="Aba Chat com Vito"
      >
        <View
          style={[
            styles.activeIndicator,
            activeTab === 'chat' && [
              styles.activeIndicatorSelected,
              {
                backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.outlineVariant,
              },
            ],
          ]}
        >
          <MaterialIcons
            name={activeTab === 'chat' ? 'chat' : 'chat-bubble-outline'}
            size={20}
            color={
              activeTab === 'chat'
                ? isDark
                  ? '#FFFFFF'
                  : '#FFFFFF'
                : colors.onSurfaceVariant
            }
          />
        </View>
        <Text
          style={[
            styles.navLabel,
            { color: activeTab === 'chat' ? colors.onSurface : colors.textMuted },
            activeTab === 'chat' && styles.navLabelActive,
          ]}
        >
          Chat
        </Text>
      </TouchableOpacity>

      {/* Item 2: Calendário & Tarefas */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectTab('calendar')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'calendar' }}
        accessibilityLabel="Aba Calendário e Tarefas"
      >
        <View
          style={[
            styles.activeIndicator,
            activeTab === 'calendar' && [
              styles.activeIndicatorSelected,
              {
                backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.outlineVariant,
              },
            ],
          ]}
        >
          <MaterialIcons
            name={activeTab === 'calendar' ? 'calendar-month' : 'calendar-today'}
            size={20}
            color={
              activeTab === 'calendar'
                ? isDark
                  ? '#FFFFFF'
                  : '#FFFFFF'
                : colors.onSurfaceVariant
            }
          />
        </View>
        <Text
          style={[
            styles.navLabel,
            { color: activeTab === 'calendar' ? colors.onSurface : colors.textMuted },
            activeTab === 'calendar' && styles.navLabelActive,
          ]}
        >
          Calendário
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Barra de Navegação M3 Canônica Ancorada na Base
  navBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: tokens.colors.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outlineVariant,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    paddingVertical: 2,
  },
  // Indicador Ativo M3 Canônico: Pílula Oval Horizontal 64x32dp
  activeIndicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  activeIndicatorSelected: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  navLabel: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: tokens.colors.onSurface,
    fontWeight: tokens.typography.weight.bold,
  },
});

