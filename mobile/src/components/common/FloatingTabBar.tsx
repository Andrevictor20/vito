import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface FloatingTabBarProps {
  activeTab: 'chat' | 'calendar' | 'triggers';
  onSelectTab: (tab: 'chat' | 'calendar' | 'triggers') => void;
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
    <View style={styles.floatingWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.dockPill,
          {
            backgroundColor: isDark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: colors.outlineVariant,
          },
        ]}
        accessibilityRole="tablist"
      >
        {/* Item 1: Chat IA */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'chat' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
            ],
          ]}
          onPress={() => onSelectTab('chat')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
          accessibilityLabel="Aba Chat com Vito"
        >
          <MaterialIcons
            name={activeTab === 'chat' ? 'chat' : 'chat-bubble-outline'}
            size={20}
            color={activeTab === 'chat' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {/* Item 2: Calendário & Tarefas */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'calendar' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
            ],
          ]}
          onPress={() => onSelectTab('calendar')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'calendar' }}
          accessibilityLabel="Aba Calendário e Tarefas"
        >
          <MaterialIcons
            name={activeTab === 'calendar' ? 'event' : 'calendar-today'}
            size={20}
            color={activeTab === 'calendar' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {/* Item 3: Radares */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'triggers' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
            ],
          ]}
          onPress={() => onSelectTab('triggers')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'triggers' }}
          accessibilityLabel="Aba Radares e Alertas"
        >
          <MaterialIcons
            name={activeTab === 'triggers' ? 'radar' : 'track-changes'}
            size={20}
            color={activeTab === 'triggers' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 26,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  dockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  tabButton: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    elevation: 2,
  },
});

