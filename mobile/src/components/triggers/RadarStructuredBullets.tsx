import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface RadarStructuredBulletsProps {
  bullets: string[];
  bulletColor?: string;
}

export const RadarStructuredBullets: React.FC<RadarStructuredBulletsProps> = ({
  bullets,
  bulletColor,
}) => {
  const { colors } = useTheme();

  if (!bullets || bullets.length === 0) {
    return null;
  }

  const dotColor = bulletColor || colors.primary;

  return (
    <View style={styles.container}>
      {bullets.map((bullet, idx) => (
        <View key={`b-${idx}`} style={styles.bulletRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text
            style={[styles.bulletText, { color: colors.ink }]}
            selectable
          >
            {bullet}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    gap: 7,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 9,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19.5,
  },
});
