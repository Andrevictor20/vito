import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import { hapticFeedback } from '../../../theme/motion';
import type { TaskBucket } from '../utils/taskBuckets';

interface TaskGroupHeaderProps {
  bucket: TaskBucket;
  title: string;
  count: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Cabeçalho de grupo colapsável por prazo (.gh) fiel a vito-telas.html.
 */
export const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({
  bucket,
  title,
  count,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { colors } = useTheme();
  const isRed = bucket === 'atr';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => {
        if (!onToggleCollapse) return;
        hapticFeedback.selection();
        onToggleCollapse();
      }}
      activeOpacity={onToggleCollapse ? 0.7 : 1}
      disabled={!onToggleCollapse}
      accessibilityRole={onToggleCollapse ? 'button' : 'header'}
      accessibilityState={onToggleCollapse ? { expanded: !collapsed } : undefined}
      accessibilityLabel={`${title}, ${count} tarefas`}
    >
      <Text
        style={[
          styles.title,
          {
            color: isRed ? colors.red : colors.ink,
            fontFamily: tokens.typography.family.montserratBold,
          },
        ]}
      >
        {title}
      </Text>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: isRed ? colors.redBg : colors.surf,
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            {
              color: isRed ? colors.red : colors.muted,
              fontFamily: tokens.typography.family.semibold,
            },
          ]}
        >
          {count}
        </Text>
      </View>

      <View style={styles.spacer} />

      {onToggleCollapse && (
        <ProtoUiIcon
          name={collapsed ? 'keyboard-arrow-right' : 'keyboard-arrow-down'}
          size={20}
          color={colors.muted}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 6,
    paddingHorizontal: 20,
    minHeight: 36,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  spacer: { flex: 1 },
});
