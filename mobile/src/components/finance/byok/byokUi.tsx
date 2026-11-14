import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeColors } from '../../../theme/tokens';

/** Resolve tokens `--fin` e `--fin-bg` de forma segura (compatível antes/depois de `tokens.ts`). */
export function getFinTokens(colors: ThemeColors, isDark: boolean) {
  const ext = colors as ThemeColors & { fin?: string; finBg?: string };
  return {
    fin: ext.fin ?? (isDark ? '#f5b93d' : '#a8710a'),
    finBg: ext.finBg ?? (isDark ? '#3a2b0b' : '#fbf0d8'),
  };
}

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  primary,
  busy,
  disabled,
  icon,
  style,
}) => {
  const { colors } = useTheme();
  const off = disabled || busy;
  const fg = primary ? colors.bg : colors.ink;
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        primary
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: colors.bg, borderColor: colors.ink },
        off && { opacity: 0.5 },
        style,
      ]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <MaterialIcons name={icon} size={17} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const ErrorText: React.FC<{ message: string }> = ({ message }) => {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={styles.err} accessibilityLiveRegion="polite">
      <MaterialIcons name="error-outline" size={16} color={colors.red} />
      <Text style={[styles.errText, { color: colors.red }]}>{message}</Text>
    </View>
  );
};

export const StatusBanner: React.FC<{
  kind: 'loading' | 'ok' | 'bad';
  title: string;
  subtitle?: string;
}> = ({ kind, title, subtitle }) => {
  const { colors } = useTheme();
  const bg = kind === 'ok' ? colors.greenBg : kind === 'bad' ? colors.redBg : colors.surf;
  return (
    <View style={[styles.sst, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      {kind === 'loading' ? (
        <ActivityIndicator size="small" color={colors.ink} style={styles.sstSpinner} />
      ) : (
        <View style={[styles.seal, { backgroundColor: kind === 'ok' ? colors.acc : colors.red }]}>
          {kind === 'ok' ? (
            <MaterialIcons name="check" size={14} color="#FFFFFF" />
          ) : (
            <Text style={styles.sealBang}>!</Text>
          )}
        </View>
      )}
      <View style={styles.sstBody}>
        <Text style={[styles.sstTitle, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sstSub, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

export const VerticalStep: React.FC<{
  index: number;
  title: string;
  state: 'locked' | 'active' | 'done';
  isLast?: boolean;
  showDoneBody?: boolean;
  children?: React.ReactNode;
}> = ({ index, title, state, isLast, showDoneBody, children }) => {
  const { colors } = useTheme();
  const badgeStyle =
    state === 'done'
      ? { backgroundColor: colors.acc, borderColor: colors.acc }
      : state === 'active'
        ? { backgroundColor: colors.ink, borderColor: colors.ink }
        : { backgroundColor: colors.bg, borderColor: colors.line };

  return (
    <View style={styles.vs}>
      <View style={styles.vn}>
        <View style={[styles.badge, badgeStyle]}>
          {state === 'done' ? (
            <MaterialIcons name="check" size={16} color="#FFFFFF" />
          ) : (
            <Text style={[styles.badgeNum, { color: state === 'active' ? colors.bg : colors.muted }]}>{index}</Text>
          )}
        </View>
        {!isLast && <View style={[styles.connector, { backgroundColor: state === 'done' ? colors.acc : colors.line }]} />}
      </View>
      <View style={[styles.vb, isLast && styles.vbLast]}>
        <View style={styles.vh}>
          <Text style={[styles.vhTitle, { color: state === 'locked' ? colors.muted : colors.ink }]}>{title}</Text>
          {state === 'done' && (
            <View style={[styles.pillst, { backgroundColor: colors.greenBg }]}>
              <View style={[styles.pillDot, { backgroundColor: colors.acc }]} />
              <Text style={[styles.pillText, { color: colors.acc }]}>Concluída</Text>
            </View>
          )}
        </View>
        {(state === 'active' || (state === 'done' && showDoneBody)) && <View style={styles.stepBody}>{children}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  btn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 14.5, fontWeight: '600' },
  err: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 10 },
  errText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  sst: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 14 },
  sstSpinner: { marginTop: 2 },
  sstBody: { flex: 1 },
  sstTitle: { fontSize: 14, fontWeight: '600' },
  sstSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  seal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sealBang: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  vs: { flexDirection: 'row', gap: 14 },
  vn: { width: 32, alignItems: 'center' },
  badge: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeNum: { fontSize: 14, fontWeight: '700' },
  connector: { width: 2, flex: 1, marginTop: 4, marginBottom: 4, minHeight: 16 },
  vb: { flex: 1, minWidth: 0, paddingBottom: 22 },
  vbLast: { paddingBottom: 4 },
  vh: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, flexWrap: 'wrap' },
  vhTitle: { fontSize: 16, fontWeight: '600' },
  pillst: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  stepBody: { marginTop: 4 },
});
