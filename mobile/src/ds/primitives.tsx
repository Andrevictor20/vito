import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getBezier, resolveRule, token } from './tokens'

export interface ProtoScreenProps extends ScrollViewProps {
  isDark?: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/** `.screen`: padding 10 20 112, flex 1, scroll vertical sem barra. */
export const ProtoScreen: React.FC<ProtoScreenProps> = ({
  isDark = false,
  style,
  contentContainerStyle,
  children,
  ...rest
}) => {
  const bg = token('--bg', isDark)
  const r = resolveRule('.screen', isDark).style
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={[{ flex: 1, backgroundColor: bg }, style]}
      contentContainerStyle={[
        {
          paddingTop: (r.paddingTop as number) ?? 10,
          paddingHorizontal: (r.paddingRight as number) ?? 20,
          paddingBottom: (r.paddingBottom as number) ?? 112,
        },
        contentContainerStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  )
}

export const ProtoCard: React.FC<{
  isDark?: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}> = ({ isDark = false, style, children }) => {
  const base = resolveRule('.card2', isDark).style as ViewStyle
  return <View style={[base, style]}>{children}</View>
}

export const ProtoEyebrow: React.FC<{
  isDark?: boolean
  style?: StyleProp<TextStyle>
  children: React.ReactNode
}> = ({ isDark = false, style, children }) => {
  const base = resolveRule('.eyebrow', isDark).style as TextStyle
  return (
    <Text style={[base, { textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  )
}

export const ProtoBig: React.FC<{
  isDark?: boolean
  style?: StyleProp<TextStyle>
  children: React.ReactNode
}> = ({ isDark = false, style, children }) => {
  const base = resolveRule('.big', isDark).style as TextStyle
  return (
    <Text
      style={[
        base,
        { color: token('--ink', isDark), fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

export const ProtoButton: React.FC<{
  label: string
  onPress?: () => void
  variant?: 'outline' | 'primary'
  isDark?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}> = ({ label, onPress, variant = 'outline', isDark = false, disabled = false, style }) => {
  const base = resolveRule('.bbtn', isDark).style as ViewStyle
  const ink = token('--ink', isDark)
  const bg = token('--bg', isDark)
  const isPrimary = variant === 'primary'
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={[
        base,
        isPrimary ? { backgroundColor: ink, borderColor: ink } : { borderColor: ink },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: 'Geist',
          fontWeight: '500',
          fontSize: 14,
          color: isPrimary ? bg : ink,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export const ProtoInput: React.FC<
  TextInputProps & { isDark?: boolean }
> = ({ isDark = false, style, ...rest }) => {
  const base = resolveRule('.ai-key', isDark).style as TextStyle
  return (
    <TextInput
      placeholderTextColor={token('--muted', isDark)}
      style={[base, style]}
      {...rest}
    />
  )
}

export const ProtoChips: React.FC<{
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}> = ({ style, children }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={[{ flexDirection: 'row', gap: 8, paddingHorizontal: 20 }, style]}
    style={{ marginHorizontal: -20, marginTop: 16 }}
  >
    {children}
  </ScrollView>
)

export const ProtoSwitch: React.FC<{
  value: boolean
  onToggle?: () => void
  isDark?: boolean
  accessibilityLabel?: string
}> = ({ value, onToggle, isDark = false, accessibilityLabel }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 250,
      easing: Easing.bezier(...getBezier('--ease-std')),
      useNativeDriver: true,
    }).start()
  }, [value, anim])

  const trackBg = value ? token('--acc', isDark) : token('--line', isDark)
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      style={styles.swWrap}
    >
      <View style={[styles.swTrack, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[
            styles.swKnob,
            {
              backgroundColor: '#ffffff',
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, 21],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  )
}

export const ProtoToast: React.FC<{
  message: string | null
  isDark?: boolean
}> = ({ message, isDark = false }) => {
  const opacity = useRef(new Animated.Value(0)).current
  const ty = useRef(new Animated.Value(12)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: message ? 1 : 0,
        duration: 300,
        easing: Easing.bezier(...getBezier('--ease-std')),
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: message ? 0 : 12,
        duration: 300,
        easing: Easing.bezier(...getBezier('--ease-q')),
        useNativeDriver: true,
      }),
    ]).start()
  }, [message, opacity, ty])

  if (!message) return null
  const base = resolveRule('.toast', isDark).style as ViewStyle
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        base,
        styles.toastCenter,
        { opacity, transform: [{ translateY: ty }] },
      ]}
    >
      <Text style={{ fontFamily: 'Geist', fontWeight: '500', fontSize: 13, color: token('--bg', isDark) }}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  swWrap: {
    width: 50,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  swKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toastCenter: {
    alignSelf: 'center',
    left: undefined,
  },
})
