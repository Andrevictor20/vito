import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

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
      <View style={styles.capsule}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
          onPress={() => onSelectTab('chat')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
          accessibilityLabel="Aba Chat Executivo"
        >
          <MaterialIcons
            name="chat-bubble"
            size={18}
            color={activeTab === 'chat' ? tokens.colors.primary : tokens.colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'chat' && styles.tabLabelActive]}>
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'calendar' && styles.tabButtonActive]}
          onPress={() => onSelectTab('calendar')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'calendar' }}
          accessibilityLabel="Aba Calendário e Agenda"
        >
          <MaterialIcons
            name="calendar-today"
            size={18}
            color={activeTab === 'calendar' ? tokens.colors.primary : tokens.colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'calendar' && styles.tabLabelActive]}>
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
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 32, 34, 0.95)',
    borderRadius: tokens.radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    gap: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing.md + 2,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
    minHeight: 40,
  },
  tabButtonActive: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.15)',
  },
  tabLabel: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  tabLabelActive: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
});
