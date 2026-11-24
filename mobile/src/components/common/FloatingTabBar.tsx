import React, { useCallback, useEffect, useRef } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getDockGlassStyle } from '../../theme/surfaces';
import { MOTION_CURVES, MOTION_DURATIONS, PRESS_SCALE, hapticFeedback } from '../../theme/motion';
import { useReduceMotion } from '../../theme/vitoMotion';
import type { MainTabType } from '../../utils/navigation/pagerNavigation';

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

const DockSvgIcon: React.FC<{ id: DockTabType; color: string }> = ({ id, color }) => {
  switch (id) {
    case 'chat':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 1-2z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinejoin="round"
            fill="none"
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

const DOCK_SPRING = { damping: 21, stiffness: 250, mass: 1 };
const ICON_SPRING = { damping: 12, stiffness: 320, mass: 1 };

const DockTabButton: React.FC<{
  tab: (typeof DOCK_TABS)[number];
  isActive: boolean;
  onPress: () => void;
  onMeasure: (id: DockTabType, x: number, width: number) => void;
  bg: string;
  muted: string;
  reduceMotion: boolean;
}> = ({ tab, isActive, onPress, onMeasure, bg, muted, reduceMotion }) => {
  const expand = useSharedValue(isActive ? 1 : 0);
  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(expand);
      cancelAnimation(iconScale);
      cancelAnimation(iconRotate);
      expand.value = isActive ? 1 : 0;
      iconScale.value = 1;
      iconRotate.value = 0;
      prevActive.current = isActive;
      return;
    }

    expand.value = withSpring(isActive ? 1 : 0, DOCK_SPRING);

    if (isActive && !prevActive.current) {
      iconScale.value = withSequence(
        withTiming(0.82, { duration: 75, easing: Easing.out(Easing.quad) }),
        withSpring(1, ICON_SPRING),
      );
      iconRotate.value = withSequence(
        withTiming(-11, { duration: 75, easing: Easing.out(Easing.quad) }),
        withSpring(0, ICON_SPRING),
      );
    }
    prevActive.current = isActive;
  }, [isActive, reduceMotion, expand, iconScale, iconRotate]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onMeasure(tab.id, x, width);
    },
    [onMeasure, tab.id],
  );

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    paddingHorizontal: interpolate(expand.value, [0, 1], [12, 16], Extrapolation.CLAMP),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { rotate: `${iconRotate.value}deg` }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(expand.value, [0, 1], [0, 88], Extrapolation.CLAMP),
    marginLeft: interpolate(expand.value, [0, 1], [0, 8], Extrapolation.CLAMP),
    opacity: interpolate(expand.value, [0, 0.28, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(expand.value, [0, 1], [-6, 0], Extrapolation.CLAMP) },
    ],
    overflow: 'hidden',
  }));

  const stdEase = Easing.bezier(
    MOTION_CURVES.std[0],
    MOTION_CURVES.std[1],
    MOTION_CURVES.std[2],
    MOTION_CURVES.std[3]
  );

  return (
    <Pressable
      onLayout={handleLayout}
      onPress={onPress}
      onPressIn={() => {
        if (reduceMotion) return;
        pressScale.value = withTiming(PRESS_SCALE, {
          duration: MOTION_DURATIONS.press,
          easing: stdEase,
        });
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        pressScale.value = withSpring(1, ICON_SPRING);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.accessibilityLabel}
    >
      <Animated.View style={pressStyle}>
        <Animated.View style={[styles.tabButton, buttonStyle]}>
          <Animated.View style={iconStyle}>
            <DockSvgIcon id={tab.id} color={isActive ? bg : muted} />
          </Animated.View>

          <Animated.View style={labelStyle}>
            <Text style={[styles.tabLabel, { color: bg }]} numberOfLines={1}>
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
  const insets = useSafeAreaInsets();

  // `.dock` (L984–985): entra com transform 420ms ease-q + opacity 280ms ease-std;
  // sai com transform 280ms ease-in + opacity 200ms ease-in. Nunca desmonta.
  const slide = useSharedValue(visible ? 1 : 0);
  const fade = useSharedValue(visible ? 1 : 0);

  // Pílula deslizante do item ativo na navbar (Reanimated 4 UI thread spring)
  const layoutsRef = useRef<Partial<Record<DockTabType, { x: number; width: number }>>>({});
  const indicatorReadyRef = useRef(false);
  const indicatorX = useSharedValue(8);
  const indicatorW = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const syncIndicator = useCallback(
    (tabId: DockTabType, animate: boolean) => {
      const m = layoutsRef.current[tabId];
      if (!m || m.width <= 0) return;
      if (!indicatorReadyRef.current || !animate || reduceMotion) {
        indicatorReadyRef.current = true;
        indicatorX.value = m.x;
        indicatorW.value = m.width;
        indicatorOpacity.value = 1;
        return;
      }
      indicatorX.value = withSpring(m.x, DOCK_SPRING);
      indicatorW.value = withSpring(m.width, DOCK_SPRING);
      indicatorOpacity.value = 1;
    },
    [indicatorOpacity, indicatorW, indicatorX, reduceMotion],
  );

  const handleMeasureTab = useCallback(
    (id: DockTabType, x: number, width: number) => {
      layoutsRef.current[id] = { x, width };
      if (id === activeTab) {
        syncIndicator(id, indicatorReadyRef.current);
      }
    },
    [activeTab, syncIndicator],
  );

  useEffect(() => {
    if (DOCK_TABS.some((t) => t.id === activeTab)) {
      syncIndicator(activeTab as DockTabType, true);
    }
  }, [activeTab, syncIndicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(slide);
      cancelAnimation(fade);
      slide.value = visible ? 1 : 0;
      fade.value = visible ? 1 : 0;
      return;
    }

    const slideCurve = visible ? MOTION_CURVES.q : MOTION_CURVES.in;
    const fadeCurve = visible ? MOTION_CURVES.std : MOTION_CURVES.in;

    slide.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 420 : 280,
      easing: Easing.bezier(slideCurve[0], slideCurve[1], slideCurve[2], slideCurve[3]),
    });
    fade.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 280 : 200,
      easing: Easing.bezier(fadeCurve[0], fadeCurve[1], fadeCurve[2], fadeCurve[3]),
    });
  }, [visible, reduceMotion, slide, fade]);

  const dockStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      {
        translateY: interpolate(slide.value, [0, 1], [28, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const handleTabPress = (tab: DockTabType) => {
    if (tab !== activeTab) {
      hapticFeedback.selection();
    }
    onSelectTab(tab);
  };

  return (
    <Animated.View
      style={[
        styles.dockContainer,
        { paddingBottom: (insets.bottom || 8) + 8 },
        dockStyle,
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {/* Gradiente `.dock`: transparente → bg em 36% (L160). */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="vitoDockFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
              <Stop offset="0.36" stopColor={colors.bg} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#vitoDockFade)" />
        </Svg>
      </View>

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
        {/** Indicador deslizante ativo (pílula que viaja com mola entre as abas) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingIndicator,
            { backgroundColor: colors.ink },
            indicatorStyle,
          ]}
        />
        {DOCK_TABS.map((tab) => (
          <DockTabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onPress={() => handleTabPress(tab.id)}
            onMeasure={handleMeasureTab}
            bg={colors.bg}
            muted={colors.muted}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 99,
  },
  dockPill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 6,
  },
  slidingIndicator: {
    position: 'absolute',
    left: 0,
    top: 7,
    height: 46,
    borderRadius: 23,
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
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    paddingRight: 2,
  },
});
