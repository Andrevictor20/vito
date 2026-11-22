import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { getDockGlassStyle } from '../../theme/surfaces';
import { MOTION_CURVES, MOTION_DURATIONS, PRESS_SCALE, hapticFeedback } from '../../theme/motion';
import { useReduceMotion } from '../../theme/vitoMotion';
import type { MainTabType } from '../../utils/pagerNavigation';

export type DockTabType = 'chat' | 'calendar' | 'tasks' | 'finance' | 'triggers';

export const DOCK_TABS: readonly {
  id: DockTabType;
  label: string;
  accessibilityLabel: string;
}[] = [
  { id: 'chat', label: 'Vito', accessibilityLabel: 'Aba Vito' },
  { id: 'calendar', label: 'Agenda', accessibilityLabel: 'Aba Agenda' },
  { id: 'tasks', label: 'Tarefas', accessibilityLabel: 'Aba Tarefas' },
  { id: 'finance', label: 'Finanças', accessibilityLabel: 'Aba Finanças' },
  { id: 'triggers', label: 'Bots', accessibilityLabel: 'Aba Bots' },
] as const;

interface FloatingTabBarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  visible?: boolean;
}

const DockSvgIcon: React.FC<{ id: DockTabType; color: string; active: boolean }> = ({
  id,
  color,
  active,
}) => {
  switch (id) {
    case 'chat':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 1-2z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinejoin="round"
            fill={active ? color : 'none'}
            fillOpacity={active ? 0.14 : 0}
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zM5 9v11h14V9z"
            fill={color}
          />
        </Svg>
      );
    case 'tasks':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 7l2 2 3-4M4 16l2 2 3-4M13 8h7M13 17h7"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'finance':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 7a2 2 0 0 1 2-2h12v3M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={16.5} cy={14} r={1.2} fill={color} />
        </Svg>
      );
    case 'triggers':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3v3M2 12v2M22 12v2"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
          />
          <Circle cx={12} cy={2.5} r={1} fill={color} />
          <Rect
            x={4}
            y={7}
            width={16}
            height={12}
            rx={4}
            stroke={color}
            strokeWidth={2.1}
          />
          <Circle cx={9.2} cy={13} r={1.3} fill={color} />
          <Circle cx={14.8} cy={13} r={1.3} fill={color} />
        </Svg>
      );
  }
};

const DockTabButton: React.FC<{
  tab: (typeof DOCK_TABS)[number];
  isActive: boolean;
  onPress: () => void;
  ink: string;
  bg: string;
  muted: string;
  reduceMotion: boolean;
}> = ({ tab, isActive, onPress, ink, bg, muted, reduceMotion }) => {
  const expandAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (reduceMotion) {
      expandAnim.setValue(isActive ? 1 : 0);
      bounceAnim.setValue(0);
      prevActive.current = isActive;
      return;
    }

    Animated.timing(expandAnim, {
      toValue: isActive ? 1 : 0,
      duration: 380,
      easing: Easing.bezier(...MOTION_CURVES.q),
      useNativeDriver: false,
    }).start();

    if (isActive && !prevActive.current) {
      bounceAnim.setValue(0);
      Animated.timing(bounceAnim, {
        toValue: 1,
        duration: MOTION_DURATIONS.navBounce,
        easing: Easing.bezier(...MOTION_CURVES.q),
        useNativeDriver: true,
      }).start();
    }
    prevActive.current = isActive;
  }, [isActive, reduceMotion, expandAnim, bounceAnim]);

  const iconScale = bounceAnim.interpolate({
    inputRange: [0, 0.01, 0.6, 1],
    outputRange: [1, 0.6, 1.2, 1],
  });
  const iconRotate = bounceAnim.interpolate({
    inputRange: [0, 0.01, 0.6, 1],
    outputRange: ['0deg', '-14deg', '5deg', '0deg'],
  });
  const labelMaxWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 74],
  });
  const labelMarginLeft = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });
  const labelOpacity = expandAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const horizontalPad = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 16],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (reduceMotion) return;
        Animated.timing(pressScale, {
          toValue: PRESS_SCALE,
          duration: MOTION_DURATIONS.press,
          easing: Easing.bezier(...MOTION_CURVES.std),
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        Animated.timing(pressScale, {
          toValue: 1,
          duration: MOTION_DURATIONS.press,
          easing: Easing.bezier(...MOTION_CURVES.std),
          useNativeDriver: true,
        }).start();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Animated.View
          style={[
            styles.tabButton,
            {
              paddingHorizontal: horizontalPad,
              backgroundColor: isActive ? ink : 'transparent',
            },
          ]}
        >
          <Animated.View
            style={{
              transform: [{ scale: iconScale }, { rotate: iconRotate }],
            }}
          >
            <DockSvgIcon
              id={tab.id}
              color={isActive ? bg : muted}
              active={isActive}
            />
          </Animated.View>

          <Animated.View
            style={{
              maxWidth: labelMaxWidth,
              marginLeft: labelMarginLeft,
              opacity: labelOpacity,
              overflow: 'hidden',
            }}
          >
            <Text
              style={[styles.tabLabel, { color: bg }]}
              numberOfLines={1}
              ellipsizeMode="clip"
            >
              {tab.label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onSelectTab,
  visible = true,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();

  if (!visible) return null;

  const handleTabPress = (tab: DockTabType) => {
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
          getDockGlassStyle(isDark),
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
              } as Record<string, string>)
            : null,
        ]}
        accessibilityRole="tablist"
      >
        {DOCK_TABS.map((tab) => (
          <DockTabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onPress={() => handleTabPress(tab.id)}
            ink={colors.ink}
            bg={colors.bg}
            muted={colors.muted}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 18 : 14,
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
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 6,
  },
  tabButton: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: 'Geist',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
