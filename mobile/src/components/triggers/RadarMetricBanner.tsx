import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface RadarMetricBannerProps {
  label?: string;
  value?: string;
  categoryColor?: string;
  categoryBg?: string;
}

export const RadarMetricBanner: React.FC<RadarMetricBannerProps> = ({
  label,
  value,
  categoryColor,
  categoryBg,
}) => {
  const { colors, isDark } = useTheme();

  if (!value || value.trim().length === 0) {
    return null;
  }

  const effectiveLabel = label?.trim() || 'Destaque';
  const isMatchScore = /\d+\s*x\s*\d+/i.test(value);
  const isPrice = /r\$|\$/i.test(value);

  const accentColor = categoryColor || colors.primary;
  const bannerBg = categoryBg || (isDark ? 'rgba(255,255,255,0.04)' : colors.surf);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bannerBg,
          borderColor: colors.line,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${effectiveLabel}: ${value}`}
    >
      <View style={styles.contentRow}>
        <View style={styles.textColumn}>
          <View style={styles.labelRow}>
            {isMatchScore ? (
              <MaterialIcons name="sports-soccer" size={14} color={accentColor} />
            ) : isPrice ? (
              <MaterialIcons name="shopping-bag" size={14} color={accentColor} />
            ) : (
              <MaterialIcons name="insights" size={14} color={accentColor} />
            )}
            <Text style={[styles.labelText, { color: colors.muted }]}>
              {effectiveLabel.toUpperCase()}
            </Text>
          </View>
          <Text
            style={[
              styles.valueText,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
            numberOfLines={2}
          >
            {value}
          </Text>
        </View>

        {isMatchScore && (
          <View style={[styles.badgePill, { backgroundColor: colors.blueBg || 'rgba(43,127,212,0.12)' }]}>
            <Text style={[styles.badgeText, { color: colors.blue }]}>
              Placar Real
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textColumn: {
    flex: 1,
    marginRight: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  labelText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  valueText: {
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
