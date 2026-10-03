import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { VitoMascot, VitoMascotProps } from './VitoMascot';
import { useTheme } from '../../context/ThemeContext';

export interface VitoLogoProps {
  size?: 'small' | 'medium' | 'large';
  showWordmark?: boolean;
  showDot?: boolean;
  animated?: boolean;
  state?: VitoMascotProps['state'];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const VitoLogo: React.FC<VitoLogoProps> = ({
  size = 'medium',
  showWordmark = true,
  showDot = true,
  animated = true,
  state = 'idle',
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  // Dimensões calibradas para cada variante
  const mascotDimensions = {
    small: 26,
    medium: 38,
    large: 58,
  }[size];

  const fontDimensions = {
    small: 18,
    medium: 26,
    large: 38,
  }[size];

  const dotDimensions = {
    small: 5,
    medium: 6.5,
    large: 9,
  }[size];

  return (
    <View style={[styles.container, style]}>
      <VitoMascot
        size={mascotDimensions}
        animated={animated}
        state={state}
      />
      {showWordmark && (
        <View style={styles.brandContainer}>
          <Text
            style={[
              styles.brandText,
              {
                color: colors.onSurface,
                fontSize: fontDimensions,
              },
              textStyle,
            ]}
          >
            vito
          </Text>
          {showDot && (
            <View
              style={[
                styles.statusDot,
                {
                  width: dotDimensions,
                  height: dotDimensions,
                  borderRadius: dotDimensions / 2,
                  backgroundColor: '#10B981', // Esmeralda / Online
                },
              ]}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandText: {
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  statusDot: {
    marginLeft: 2,
    marginBottom: 2,
  },
});
