import React from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { MainTabType } from '../../utils/pagerNavigation';

interface FloatingTabBarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  visible?: boolean;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onSelectTab,
  visible = true,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const handleTabPress = (tab: MainTabType) => {
    if (tab !== activeTab) {
      hapticFeedback.selection();
    }
    onSelectTab(tab);
  };

  return (
    <View style={styles.floatingWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.dockPill,
          {
            backgroundColor: colors.surf,
            borderColor: colors.line,
            shadowColor: isDark ? '#000000' : '#141916',
          },
        ]}
        accessibilityRole="tablist"
      >
        {/* Item 1: Chat */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'chat' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('chat')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'chat' }}
          accessibilityLabel="Aba Chat com Vito"
        >
          <MaterialIcons
            name={activeTab === 'chat' ? 'chat' : 'chat-bubble-outline'}
            size={24}
            color={activeTab === 'chat' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>

        {/* Item 2: Agenda */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'calendar' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('calendar')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'calendar' }}
          accessibilityLabel="Aba Agenda"
        >
          <MaterialIcons
            name={activeTab === 'calendar' ? 'event' : 'calendar-today'}
            size={24}
            color={activeTab === 'calendar' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>

        {/* Item 3: Tarefas */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'tasks' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('tasks')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'tasks' }}
          accessibilityLabel="Aba Tarefas"
        >
          <MaterialIcons
            name={activeTab === 'tasks' ? 'task-alt' : 'checklist'}
            size={24}
            color={activeTab === 'tasks' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>

        {/* Item 4: Radares */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'triggers' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('triggers')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'triggers' }}
          accessibilityLabel="Aba Radares"
        >
          <MaterialIcons
            name={activeTab === 'triggers' ? 'radar' : 'track-changes'}
            size={24}
            color={activeTab === 'triggers' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>

        {/* Item 5: Booking */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'booking' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('booking')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'booking' }}
          accessibilityLabel="Aba Booking"
        >
          <MaterialIcons
            name={activeTab === 'booking' ? 'event-available' : 'link'}
            size={24}
            color={activeTab === 'booking' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>

        {/* Item 6: Perfil */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'profile' && [
              styles.tabButtonActive,
              { backgroundColor: colors.ink },
            ],
          ]}
          onPress={() => handleTabPress('profile')}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'profile' }}
          accessibilityLabel="Aba Perfil"
        >
          <MaterialIcons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={24}
            color={activeTab === 'profile' ? colors.bg : colors.muted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 18,
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
    padding: 8,
    borderRadius: 40,
    borderWidth: 1,
    gap: 6,
    elevation: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
  },
  tabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    width: 60,
    borderRadius: 30,
    elevation: 4,
  },
});
