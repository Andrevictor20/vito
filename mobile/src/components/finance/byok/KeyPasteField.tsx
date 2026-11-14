import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { maskSecret } from '../../../utils/pluggyKeys';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onPaste: () => void;
  secret?: boolean;
  locked?: boolean;
  invalid?: boolean;
}

/** Campo `.kf` / `.kr` (Vito-telas-atualizadas.html) com botão "Colar" integrado. */
export const KeyPasteField: React.FC<Props> = ({
  label,
  value,
  onChangeText,
  onPaste,
  secret,
  locked,
  invalid,
}) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = invalid ? colors.red : focused ? colors.ink : colors.line;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <View style={[styles.row, { borderColor, backgroundColor: colors.bg }]}>
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="00000000-0000-0000-0000-000000000000"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!locked}
          secureTextEntry={!!secret}
          accessibilityLabel={label}
        />
        <TouchableOpacity
          style={[styles.pasteBtn, { backgroundColor: colors.surf }]}
          onPress={onPaste}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`Colar ${label}`}
        >
          <Text style={[styles.pasteText, { color: colors.ink }]}>Colar</Text>
        </TouchableOpacity>
      </View>
      {secret && value.length > 0 && (
        <Text style={[styles.hint, { color: colors.muted }]}>Salvo no cofre do aparelho: {maskSecret(value)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    height: 48,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pasteBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 11.5, marginTop: 4 },
});
