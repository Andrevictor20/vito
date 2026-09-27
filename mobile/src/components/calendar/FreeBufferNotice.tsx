import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

interface FreeBufferNoticeProps {
  durationText?: string;
}

export const FreeBufferNotice: React.FC<FreeBufferNoticeProps> = ({
  durationText = 'Intervalo livre para foco individual',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{durationText}</Text>
      <MaterialIcons name="bolt" size={14} color={tokens.colors.outline} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13, 14, 16, 0.6)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 7,
    borderRadius: tokens.radii.sm,
    marginVertical: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  text: {
    color: tokens.colors.outline,
    fontSize: tokens.typography.size.xs,
    fontStyle: 'italic',
  },
});
