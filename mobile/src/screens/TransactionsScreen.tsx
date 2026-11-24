import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import type { FinanceTransaction } from '../types/finance';
import { formatBRL } from '../components/finance/financeHelpers';
import { VitoSheet } from '../components/ui/VitoSheet';

const CATEGORIES = ['Alimentação', 'Delivery', 'Transporte', 'Mercado', 'Streaming', 'Saúde', 'Lazer', 'Outros'];

interface TransactionsScreenProps {
  onClose?: () => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [txType, setTxType] = useState<'' | 'DEBIT' | 'CREDIT'>('');
  const [items, setItems] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTx, setSelectedTx] = useState<FinanceTransaction | null>(null);
  const [applyAll, setApplyAll] = useState(true);

  const loadPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      setLoading(true);
      try {
        const res = await api.finance.searchTransactions({
          q: query.trim() || undefined,
          type: txType,
          limit: 40,
          offset: nextOffset,
        });
        setHasMore(res.length === 40);
        setOffset(nextOffset + res.length);
        setItems((prev) => (reset ? res : [...prev, ...res]));
      } finally {
        setLoading(false);
      }
    },
    [query, txType],
  );

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  const handleRecategorize = async (category: string) => {
    if (!selectedTx) return;
    await api.finance.recategorizeTransaction(selectedTx.id, category, applyAll);
    setSelectedTx(null);
    void loadPage(0, true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Text style={[styles.heading, { color: colors.ink }]}>Extrato Analítico</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.fin }]}>Fechar</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar estabelecimento, descrição ou categoria..."
        placeholderTextColor={colors.muted}
        style={[styles.search, { color: colors.ink, backgroundColor: colors.surf, borderColor: colors.line }]}
      />

      <View style={styles.filters}>
        {(['', 'DEBIT', 'CREDIT'] as const).map((t) => {
          const active = txType === t;
          const label = t === '' ? 'Todas' : t === 'DEBIT' ? 'Saídas' : 'Entradas';
          return (
            <TouchableOpacity
              key={label}
              onPress={() => setTxType(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.finBg : colors.surf,
                  borderColor: active ? colors.fin : colors.line,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.fin : colors.muted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (!loading && hasMore) void loadPage(offset, false);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedTx(item)}
            style={[styles.txRow, { borderBottomColor: colors.line }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.txDesc, { color: colors.ink }]} numberOfLines={1}>
                {item.clean_merchant_name || item.description}
              </Text>
              <Text style={[styles.txMeta, { color: colors.muted }]}>
                {item.category} · {item.occurred_at.slice(0, 10)}
              </Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                { color: item.amount < 0 ? colors.ink : colors.acc },
              ]}
            >
              {formatBRL(item.amount)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <VitoSheet
        visible={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Recategorizar Lançamento"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.txDesc, { color: colors.ink }]}>
            {selectedTx?.clean_merchant_name || selectedTx?.description}
          </Text>
          <TouchableOpacity onPress={() => setApplyAll((v) => !v)} style={styles.toggleRow}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {applyAll ? '☑' : '☐'} Aplicar a todas as compras deste estabelecimento
            </Text>
          </TouchableOpacity>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => void handleRecategorize(cat)}
                style={[styles.catChip, { backgroundColor: colors.surf, borderColor: colors.line }]}
              >
                <Text style={[styles.chipText, { color: colors.ink }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </VitoSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heading: { fontSize: 22, fontWeight: '600' },
  closeText: { fontSize: 15, fontWeight: '600' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  txDesc: { fontSize: 14, fontWeight: '600' },
  txMeta: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sheetBody: { gap: 12, paddingBottom: 20 },
  toggleRow: { paddingVertical: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
