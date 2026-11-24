import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../icons/ProtoUiIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { tokens } from '../theme/tokens';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import { mergeProvidersWithCatalog } from '../services/ai/aiProviderCatalog';
import type { UserAIProvider } from '../types/aiProviders';
import { AiProviderLogo } from '../components/ai/AiProviderLogo';
import { AiProviderSheet } from '../components/ai/AiProviderSheet';

type FilterTab = 'Todas' | 'Conectados' | 'Disponíveis';
const FILTER_TABS: FilterTab[] = ['Todas', 'Conectados', 'Disponíveis'];

export const AiProvidersScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [providers, setProviders] = useState<UserAIProvider[]>(() => mergeProvidersWithCatalog([]));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('Todas');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const loadProviders = useCallback(async () => {
    try {
      const list = await api.aiProviders.listProviders();
      setProviders(mergeProvidersWithCatalog(list));
    } catch {
      setProviders((prev) => (prev.length ? prev : mergeProvidersWithCatalog([])));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const ownConnectedCount = useMemo(
    () => providers.filter((p) => p.provider_key !== 'srv' && p.status === 'ok').length,
    [providers]
  );
  const totalAvailableCount = useMemo(
    () => providers.filter((p) => p.status === 'disconnected').length,
    [providers]
  );
  const headerSubtitle = `${ownConnectedCount ? `Servidor + ${ownConnectedCount} ${ownConnectedCount === 1 ? 'próprio' : 'próprios'}` : 'Só servidor'} · ${totalAvailableCount} disponíveis`;

  const matchesFilter = useCallback(
    (p: UserAIProvider) => {
      const isActive = p.status === 'ok' || p.status === 'invalid';
      if (filterTab === 'Conectados' && !isActive) return false;
      if (filterTab === 'Disponíveis' && isActive) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const modelsText = (p.models || []).map((m) => `${m.name} ${m.note || ''}`).join(' ');
      return `${p.name || ''} ${p.company || ''} ${modelsText}`.toLowerCase().includes(q);
    },
    [filterTab, query]
  );

  const activeProviders = useMemo(
    () => providers.filter((p) => (p.status === 'ok' || p.status === 'invalid') && matchesFilter(p)),
    [providers, matchesFilter]
  );
  const availableProviders = useMemo(
    () => providers.filter((p) => p.status === 'disconnected' && matchesFilter(p)),
    [providers, matchesFilter]
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.provider_key === selectedKey) || null,
    [providers, selectedKey]
  );

  const renderProviderRow = (p: UserAIProvider, idx: number) => {
    const isOk = p.status === 'ok';
    const isInvalid = p.status === 'invalid';
    const modelCount = p.model_count ?? p.models?.length ?? 0;
    const subText = p.fixed
      ? `${p.company} · seleção automática sem chave`
      : isOk
        ? `${p.company} · ${modelCount} ${modelCount === 1 ? 'modelo' : 'modelos'} · ••••${p.key_last4 || ''}`
        : isInvalid
          ? `${p.company} · chave recusada · ••••${p.key_last4 || ''}`
          : p.company || '';

    return (
      <TouchableOpacity
        key={p.provider_key}
        style={[styles.row, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
        onPress={() => setSelectedKey(p.provider_key)}
        activeOpacity={0.7}
      >
        <AiProviderLogo providerKey={p.provider_key} size={36} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>{p.name}</Text>
          <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
            {subText}
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: isInvalid ? colors.redBg : isOk ? colors.greenBg : colors.bg,
              borderColor: isInvalid ? colors.red : isOk ? colors.acc : colors.line,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: isInvalid ? colors.red : isOk ? colors.acc : colors.ink },
            ]}
          >
            {p.fixed ? 'Padrão' : isOk ? 'Conectado' : isInvalid ? 'Inválida' : 'Conectar'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.roundBtn, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
          onPress={() => navigation.goBack()}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Voltar"
        >
          <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Provedores de IA</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.roundBtn, { backgroundColor: colors.ink, borderColor: colors.ink }]}
          onPress={() => setSelectedKey('custom')}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Adicionar endpoint compatível"
        >
          <ProtoUiIcon name="add" size={21} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <ProtoUiIcon name="search" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.ink }]}
            placeholder="Buscar provedores ou modelos"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar provedores ou modelos"
          />
        </View>

        <View style={styles.chipsRow}>
          {FILTER_TABS.map((tab) => {
            const active = filterTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => setFilterTab(tab)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="small" color={colors.ink} />
        ) : activeProviders.length === 0 && availableProviders.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhum provedor encontrado.
          </Text>
        ) : (
          <>
            {activeProviders.length > 0 && (
              <>
                <View style={styles.secHeader}>
                  <Text style={[styles.secTitle, { color: colors.muted }]}>Ativos</Text>
                  <Text style={[styles.secCount, { color: colors.muted }]}>{activeProviders.length}</Text>
                </View>
                <View style={[styles.listCard, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
                  {activeProviders.map(renderProviderRow)}
                </View>
              </>
            )}

            {availableProviders.length > 0 && (
              <>
                <View style={styles.secHeader}>
                  <Text style={[styles.secTitle, { color: colors.muted }]}>Com chave própria</Text>
                  <Text style={[styles.secCount, { color: colors.muted }]}>{availableProviders.length}</Text>
                </View>
                <View style={[styles.listCard, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
                  {availableProviders.map(renderProviderRow)}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {!!toastMsg && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toastMsg}</Text>
        </View>
      )}

      <AiProviderSheet
        visible={Boolean(selectedProvider)}
        provider={selectedProvider}
        onClose={() => setSelectedKey(null)}
        onUpdated={(_updated, msg) => {
          loadProviders();
          dataSync.notify('refresh_ai_providers');
          if (msg) setToastMsg(msg);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.73,
  },
  headerSub: { fontFamily: 'Geist', fontSize: 13, marginTop: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 48 },
  searchBox: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 8 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  secHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  secTitle: { fontFamily: 'Geist_500Medium', fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  secCount: { fontFamily: 'Geist_500Medium', fontSize: 12, fontWeight: '500' },
  listCard: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 32, fontSize: 14 },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: { fontSize: 13, fontWeight: '600' },
});
