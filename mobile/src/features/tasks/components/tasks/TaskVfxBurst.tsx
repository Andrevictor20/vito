import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';

const PARTICLE_COUNT = 12;

interface TaskVfxBurstProps {
  triggerKey: number;
}

export const TaskVfxBurst: React.FC<TaskVfxBurstProps> = ({ triggerKey }) => {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (triggerKey <= 0) return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted || reduced) return;
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [triggerKey, progress]);

  if (triggerKey <= 0) return null;

  const ringScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.2],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.95, 0.85, 0],
  });

  const palette = [colors.purple, colors.acc, colors.blue, colors.orange];

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.purple,
            opacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const dist = 22 + (i % 3) * 7;
        const tx = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(angle) * dist],
        });
        const ty = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(angle) * dist],
        });
        const dotScale = progress.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0.5, 1.15, 0.1],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: palette[i % palette.length],
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { scale: dotScale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 20,
    top: 14,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  ring: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  particle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
