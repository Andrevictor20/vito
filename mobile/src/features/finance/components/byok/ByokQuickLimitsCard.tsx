import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import type { FinanceLimitSuggestion } from '../../types/finance';
import { formatBRL } from '../../utils/financeHelpers';

interface ByokQuickLimitsCardProps {
  suggestions: FinanceLimitSuggestion[];
  onActivateSuggestion: (s: FinanceLimitSuggestion) => Promise<void> | void;
  onOpenCustom: () => void;
}

/**
 * Handoff opcional pós-1º Edge-Sync (Plano 06 §2.4 / Plano 05 Onda 1):
 * sugere tetos iniciais em 1 toque com base nos gastos recém-sincronizados.
 */
export const ByokQuickLimitsCard: React.FC<ByokQuickLimitsCardProps> = ({
  suggestions,
  onActivateSuggestion,
  onOpenCustom,
}) => {
  const { colors } = useTheme();
  const [activatedKeys, setActivatedKeys] = useState<string[]>([]);

  if (suggestions.length === 0) return null;

  const handlePress = async (s: FinanceLimitSuggestion, key: string) => {
    try {
      await onActivateSuggestion(s);
      setActivatedKeys((prev) => [...prev, key]);
    } catch {
      Alert.alert('Erro', 'Não foi possível ativar este limite agora.');
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Quer alertas automáticos de gasto?</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Ative tetos sugeridos com 1 toque para o Vito avisar antes de estourar o mês.
      </Text>
      {suggestions.slice(0, 3).map((s) => {
        const key = `${s.scope_type}:${s.title}`;
        const done = activatedKeys.includes(key);
        return (
          <View key={key} style={[styles.row, { borderColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.ink }]}>{s.title}</Text>
              <Text style={[styles.itemReason, { color: colors.muted }]}>
                Sugerido: {formatBRL(s.suggested_amount)} · {s.reason}
              </Text>
            </View>
            <TouchableOpacity
              disabled={done}
              onPress={() => void handlePress(s, key)}
              style={[
                styles.btn,
                { backgroundColor: done ? colors.btn : colors.finBg },
              ]}
            >
              <Text style={[styles.btnText, { color: done ? colors.muted : colors.fin }]}>
                {done ? 'Ativo' : 'Ativar'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity onPress={onOpenCustom} style={styles.customLink}>
        <Text style={[styles.customLinkText, { color: colors.fin }]}>
          Configurar limite personalizado
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemReason: { fontSize: 12, marginTop: 2 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  btnText: { fontSize: 12, fontWeight: '700' },
  customLink: { paddingTop: 4, alignItems: 'center' },
  customLinkText: { fontSize: 13, fontWeight: '600' },
});
