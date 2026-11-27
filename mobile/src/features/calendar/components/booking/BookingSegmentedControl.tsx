import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { tokens } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';

export type BookingTabKey = 'links' | 'appointments';

interface TabOption {
  key: BookingTabKey;
  label: string;
  count: number;
  accessibilityLabel: string;
}

interface BookingSegmentedControlProps {
  activeTab: BookingTabKey;
  linksCount: number;
  receivedCount: number;
  onSelectTab: (tab: BookingTabKey) => void;
}

export const BookingSegmentedControl: React.FC<BookingSegmentedControlProps> = ({
  activeTab,
  linksCount,
  receivedCount,
  onSelectTab,
}) => {
  const { colors } = useTheme();
  const tabs: TabOption[] = [
    { key: 'links', label: 'Links', count: linksCount, accessibilityLabel: 'Links de agendamento' },
    { key: 'appointments', label: 'Recebidos', count: receivedCount, accessibilityLabel: 'Agendamentos recebidos' },
  ];

  return (
    <View style={styles.segmentContainer}>
      <View style={[styles.segmentTrack, { backgroundColor: colors.surf }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.segmentTab,
                isActive && [styles.segmentTabActive, { backgroundColor: colors.bg }],
              ]}
              onPress={() => {
                hapticFeedback.selection();
                onSelectTab(tab.key);
              }}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.accessibilityLabel}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  {
                    color: isActive ? colors.ink : colors.muted,
                    fontFamily: isActive ? tokens.typography.family.semibold : tokens.typography.family.medium,
                  },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isActive ? colors.surf : 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: colors.muted, fontFamily: tokens.typography.family.semibold },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  segmentContainer: { paddingHorizontal: 20, marginBottom: 12 },
  segmentTrack: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 12,
  },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentTabText: { fontSize: 13.5 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 99,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11.5 },
});
