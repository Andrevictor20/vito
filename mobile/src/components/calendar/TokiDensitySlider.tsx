import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface TokiDensitySliderProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSetExpanded: (expanded: boolean) => void;
}

export const TokiDensitySlider: React.FC<TokiDensitySliderProps> = ({
  isExpanded,
  onToggleExpanded,
  onSetExpanded,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // Posiciona o slider flutuante confortavelmente acima da FloatingTabBar (bottom ~26 + altura ~56 = ~82px)
  const bottomOffset = Math.max(insets.bottom + 88, 96);

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      {/* Slider Vertical Toki */}
      <View
        style={[
          styles.sliderTrack,
          {
            backgroundColor: isDark ? 'rgba(30, 30, 30, 0.92)' : 'rgba(230, 230, 230, 0.92)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.sliderHalfTop}
          onPress={() => onSetExpanded(true)}
          activeOpacity={0.8}
          accessibilityLabel="Aumentar zoom do calendário para visualização expandida"
          accessibilityRole="button"
        />

        {/* Linha vertical central do trilho */}
        <View
          style={[
            styles.sliderRail,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)' },
          ]}
        />

        {/* Knob / Thumb do Slider */}
        <View
          style={[
            styles.sliderThumb,
            isExpanded ? styles.thumbTop : styles.thumbBottom,
            { backgroundColor: '#FFFFFF' },
          ]}
        />

        <TouchableOpacity
          style={styles.sliderHalfBottom}
          onPress={() => onSetExpanded(false)}
          activeOpacity={0.8}
          accessibilityLabel="Diminuir zoom do calendário para visualização compacta"
          accessibilityRole="button"
        />
      </View>

      {/* Botão Flutuante de Toggle Rápido ⤢ */}
      <TouchableOpacity
        style={[
          styles.expandToggleFab,
          {
            backgroundColor: isDark ? '#27272A' : '#F4F4F5',
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={onToggleExpanded}
        activeOpacity={0.8}
        accessibilityLabel={isExpanded ? 'Visualização compacta com emojis' : 'Visualização expandida com cards'}
        accessibilityRole="button"
      >
        <MaterialIcons
          name={isExpanded ? 'zoom-in-map' : 'zoom-out-map'}
          size={20}
          color={colors.onSurface}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    alignItems: 'center',
    gap: 12,
    zIndex: 90,
  },
  sliderTrack: {
    width: 28,
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sliderRail: {
    position: 'absolute',
    width: 2.5,
    height: 80,
    borderRadius: 1.25,
  },
  sliderThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  thumbTop: {
    top: 12,
  },
  thumbBottom: {
    bottom: 12,
  },
  sliderHalfTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 55,
    zIndex: 10,
  },
  sliderHalfBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 55,
    zIndex: 10,
  },
  expandToggleFab: {
    width: 44,
    height: 44,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
