import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { AutonomyMode } from '../../types';

interface ProfileAutonomyCardProps {
  mode: AutonomyMode;
  onSelectMode: (mode: AutonomyMode) => void;
  disabled?: boolean;
}

const AUTONOMY_LEVELS: { id: AutonomyMode; label: string; desc: string }[] = [
  {
    id: 'low',
    label: 'Baixo',
    desc: 'Pergunto antes de qualquer alteração.',
  },
  {
    id: 'assisted',
    label: 'Médio',
    desc: 'Faço o simples sozinho e confirmo o que apaga ou envia.',
  },
  {
    id: 'autonomous',
    label: 'Alto',
    desc: 'Resolvo sozinho e aviso depois. Exclusões em massa sempre pedem a sua confirmação.',
  },
];

export const ProfileAutonomyCard: React.FC<ProfileAutonomyCardProps> = ({
  mode,
  onSelectMode,
  disabled = false,
}) => {
  const { colors } = useTheme();

  const currentLevel = AUTONOMY_LEVELS.find((lvl) => lvl.id === mode) || AUTONOMY_LEVELS[1];

  return (
    <View style={[styles.aut, { backgroundColor: colors.bg, borderColor: colors.line }]}>
      {/* Segmented Control 3 níveis (.seg) */}
      <View style={[styles.seg, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {AUTONOMY_LEVELS.map((lvl) => {
          const isActive = lvl.id === mode;

          return (
            <TouchableOpacity
              key={lvl.id}
              style={[
                styles.segBtn,
                isActive && { backgroundColor: colors.ink },
              ]}
              onPress={() => {
                hapticFeedback.selection();
                onSelectMode(lvl.id);
              }}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segBtnText,
                  { color: isActive ? colors.bg : colors.muted },
                  isActive && styles.segBtnTextActive,
                ]}
              >
                {lvl.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Descrição contextual */}
      <Text style={[styles.desc, { color: colors.ink }]}>
        {currentLevel.desc}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  aut: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  seg: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segBtnText: {
    fontSize: 13,
    fontFamily: 'Geist_500Medium',
  },
  segBtnTextActive: {
    fontFamily: 'Geist_600SemiBold',
  },
  desc: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 12,
    marginHorizontal: 2,
  },
});
