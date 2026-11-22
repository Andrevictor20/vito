import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { getFloatingSurfaceShadow, getSbarGlassStyle } from '../../theme/surfaces';
import { PressableScale } from '../../theme/vitoMotion';
import { useTheme } from '../../context/ThemeContext';

export type HeaderRoundButtonVariant = 'default' | 'primary';

export interface HeaderRoundButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: HeaderRoundButtonVariant;
  size?: number;
  testID?: string;
  disabled?: boolean;
  badgeCount?: number;
}

/**
 * Botão circular v5 (.rb) de 44x44px com micro-compressão tátil e sombra flutuante.
 */
export const HeaderRoundButton: React.FC<HeaderRoundButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  size = 20,
  testID,
  disabled = false,
  badgeCount = 0,
}) => {
  const { colors, isDark } = useTheme();
  const isPri = variant === 'primary';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={tokens.hitSlop.sm}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
      style={[
        controlStyles.roundBtn,
        getFloatingSurfaceShadow(isDark),
        {
          backgroundColor: isPri ? colors.ink : colors.bg,
          borderColor: isPri ? colors.ink : colors.hairline,
        },
        disabled && controlStyles.btnDisabled,
      ]}
    >
      <MaterialIcons name={icon} size={size} color={isPri ? colors.bg : colors.ink} />
      {badgeCount > 0 && (
        <View
          style={[
            controlStyles.bellBadge,
            { backgroundColor: colors.red, borderColor: colors.bg },
          ]}
        />
      )}
    </PressableScale>
  );
};

export interface HeaderIconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 20,
}) => (
  <HeaderRoundButton
    icon={icon}
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    size={size}
    variant="default"
  />
);

export interface HeaderPillProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'solid' | 'ghost';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export const HeaderPill: React.FC<HeaderPillProps> = ({
  label,
  onPress,
  accessibilityLabel,
  variant = 'solid',
  icon,
}) => {
  const { colors } = useTheme();
  const ghost = variant === 'ghost';
  return (
    <PressableScale
      style={[
        controlStyles.pill,
        ghost ? { backgroundColor: colors.btn } : { backgroundColor: colors.ink },
      ]}
      onPress={onPress}
      hitSlop={tokens.hitSlop.md}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {icon ? (
        <MaterialIcons name={icon} size={16} color={ghost ? colors.ink : colors.bg} />
      ) : null}
      <Text
        style={[controlStyles.pillText, { color: ghost ? colors.ink : colors.bg }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
};

export interface SubScreenHeaderProps {
  title: string;
  subtitle?: string;
  onPressBack: () => void;
  rightAction?: React.ReactNode;
}

/**
 * Header fixo translúcido (.sbar) para sub-telas v5 (Booking, Perfil, Notificações, etc.).
 */
export const SubScreenHeader: React.FC<SubScreenHeaderProps> = ({
  title,
  subtitle,
  onPressBack,
  rightAction,
}) => {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        controlStyles.sbarWrapper,
        getSbarGlassStyle(isDark),
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            } as Record<string, string>)
          : null,
      ]}
      accessibilityRole="header"
    >
      <HeaderRoundButton
        icon="arrow-back"
        onPress={onPressBack}
        accessibilityLabel="Voltar"
        size={20}
      />
      <View style={controlStyles.sbarTitleCol}>
        <Text style={[controlStyles.sbarTitle, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[controlStyles.subtitle, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightAction ? <View style={controlStyles.acts}>{rightAction}</View> : null}
    </View>
  );
};

const controlStyles = StyleSheet.create({
  sbarWrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 4,
  },
  sbarTitleCol: { flex: 1, minWidth: 0 },
  sbarTitle: {
    fontFamily: 'Geist',
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.78,
    fontWeight: '500',
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: '400',
  },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
  },
  btnDisabled: { opacity: 0.4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    paddingHorizontal: 16,
    gap: 6,
    flexShrink: 0,
  },
  pillText: { fontFamily: 'Geist', fontSize: 14, fontWeight: '500' },
});
