import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';

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
  if (!visible) return null;

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <View style={styles.navBar}>
        {/* Item 1: Chat IA */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onSelectTab('chat')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
          accessibilityLabel="Aba Chat com Vito"
        >
          <View style={[styles.activeIndicator, activeTab === 'chat' && styles.activeIndicatorSelected]}>
            <MaterialIcons
              name={activeTab === 'chat' ? 'chat' : 'chat-bubble-outline'}
              size={22}
              color={activeTab === 'chat' ? tokens.colors.onPrimaryContainer : tokens.colors.onSurfaceVariant}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'chat' && styles.navLabelActive]}>
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
          <View style={[styles.activeIndicator, activeTab === 'calendar' && styles.activeIndicatorSelected]}>
            <MaterialIcons
              name={activeTab === 'calendar' ? 'calendar-month' : 'calendar-today'}
              size={22}
              color={activeTab === 'calendar' ? tokens.colors.onPrimaryContainer : tokens.colors.onSurfaceVariant}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'calendar' && styles.navLabelActive]}>
            Calendário
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  // Superfície Tonal M3 Elevada (Surface Container High)
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: MD3Shapes.extraLarge,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    gap: tokens.spacing.lg,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
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
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: tokens.colors.onSurface,
    fontWeight: tokens.typography.weight.bold,
  },
});

