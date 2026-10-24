import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import type { TaskBucket } from '../../utils/taskBuckets';

interface TaskGroupHeaderProps {
  bucket: TaskBucket;
  title: string;
  count: number;
}

/**
 * Cabeçalho de grupo por prazo (.gh) fiel a vito-telas.html.
 * - Tipografia: Montserrat 800 (15px, letterSpacing -0.01em)
 * - Se 'atr': cor colors.red e badge em colors.redBg + colors.red
 * - Badge .cnt: 12px, font-weight 600, padding 4px 10px, borderRadius 12px
 */
export const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({
  bucket,
  title,
  count,
}) => {
  const { colors } = useTheme();
  const isRed = bucket === 'atr';

  return (
    <View style={styles.container}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 6,
    paddingHorizontal: 20,
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
  },
});
