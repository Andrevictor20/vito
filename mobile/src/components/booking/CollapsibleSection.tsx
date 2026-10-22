import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  icon?: string;
  defaultExpanded?: boolean;
  testID?: string;
  storageKey?: string;
  onToggle?: (expanded: boolean) => void;
  emptyMessage?: string;
  emptyIcon?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  children,
  icon = 'folder-outline',
  defaultExpanded = true,
  storageKey,
  onToggle,
  emptyMessage = 'Nenhum item',
  emptyIcon = 'inbox',
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [mounted, setMounted] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // Carregar estado persistido
  useEffect(() => {
    if (storageKey) {
      AsyncStorage.getItem(`booking_section_${storageKey}`).then((value) => {
        if (value !== null) {
          const isExpanded = value === 'true';
          setExpanded(isExpanded);
          Animated.timing(heightAnim, {
            toValue: isExpanded ? 1 : 0,
            duration: 0,
            useNativeDriver: true,
          }).start();
          Animated.timing(arrowAnim, {
            toValue: isExpanded ? 0 : 1,
            duration: 0,
            useNativeDriver: true,
          }).start();
        }
      });
    }
    setMounted(true);
  }, [storageKey, heightAnim, arrowAnim]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(heightAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
    Animated.timing(arrowAnim, {
      toValue: next ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (storageKey) {
      AsyncStorage.setItem(`booking_section_${storageKey}`, String(next));
    }
    onToggle?.(next);
  };

  if (!mounted) return null;
  if (count === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainer }]}>
          <MaterialIcons name={emptyIcon as any} size={28} color={colors.onSurfaceVariant} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.headerLeft}>
          {icon && <MaterialIcons name={icon as any} size={18} color={colors.primary} />}
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{title}</Text>
          <Text style={[styles.headerCount, { color: colors.textSecondary }]}>({count})</Text>
        </View>
        <Animated.View
          style={[
            styles.chevron,
            {
              transform: [{ rotate: arrowAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
            },
          ]}
        >
          <MaterialIcons name={"keyboard-arrow-down" as any} size={20} color={colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.contentWrapper,
          {
            height: heightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, contentHeight],
            }),
          },
        ]}
      >
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== contentHeight) setContentHeight(h);
          }}
          style={styles.content}
        >
          {expanded && children}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: MD3Shapes.large,
    backgroundColor: 'transparent',
    marginBottom: tokens.booking.sectionGap,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.booking.cardPadding,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCount: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '500',
  },
  chevron: {
    padding: 4,
  },
  contentWrapper: {
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: tokens.booking.cardPadding,
    paddingBottom: tokens.booking.sectionGap,
    gap: tokens.booking.sectionGap,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});