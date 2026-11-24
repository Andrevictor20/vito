import React, { useCallback, useEffect, useState } from 'react';
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
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { api } from '../../../services/api';
import { MemoriesApi, MemoriesResponse } from '../services/memoriesApi';
import { BottomSheetModal } from '../../../components/ui/BottomSheetModal';

type MemTab = 'themes' | 'episodes' | 'facts';

export const MemoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [data, setData] = useState<MemoriesResponse>({ themes: [], episodes: [], facts: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MemTab>('themes');
  const [addOpen, setAddOpen] = useState(false);
  const [factCat, setFactCat] = useState('Preferência');
  const [factText, setFactText] = useState('');
  const [toast, setToast] = useState('');

  const memoriesClient = new MemoriesApi(api);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2400);
  };

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memoriesClient.listMemories();
      setData(res || { themes: [], episodes: [], facts: [] });
    } catch {
      setData({ themes: [], episodes: [], facts: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleDeleteTheme = async (slug: string) => {
    setData((prev) => ({ ...prev, themes: prev.themes.filter((t) => t.theme_slug !== slug) }));
    await memoriesClient.deleteThematicSummary(slug).catch(() => {});
    showToast('Memória removida');
  };

  const handleDeleteEpisode = async (id: string) => {
    setData((prev) => ({ ...prev, episodes: prev.episodes.filter((e) => e.id !== id) }));
    await memoriesClient.deleteEpisode(id).catch(() => {});
    showToast('Memória removida');
  };

  const handleDeleteFact = async (id: string) => {
    setData((prev) => ({ ...prev, facts: prev.facts.filter((f) => f.id !== id) }));
    await memoriesClient.deleteFact(id).catch(() => {});
    showToast('Memória removida');
  };

  const handleSaveFact = async () => {
    const content = factText.trim();
    if (!content) return;
    const category = factCat.trim() || 'Preferência';
    const localFact = {
      id: `f_${Date.now()}`,
      user_id: 'me',
      category,
      content,
      source: 'manual',
      confidence: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, facts: [localFact, ...prev.facts] }));
    setTab('facts');
    setFactText('');
    setAddOpen(false);
    await api.request('/api/v1/memories/facts', {
      method: 'POST',
      body: JSON.stringify({ category, content }),
    }).catch(() => {});
    showToast('Fato salvo na memória do Vito');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.sbar}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>Memória do Vito</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>O que o Vito sabe sobre mim</Text>
        </View>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.ink, borderColor: colors.ink }]}
          onPress={() => setAddOpen(true)}
          accessibilityLabel="Adicionar fato ou preferência"
        >
          <ProtoUiIcon name="add" size={22} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <View style={styles.segWrap}>
        <View style={[styles.seg, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          {[
            { id: 'themes' as MemTab, label: `Temas (${data.themes.length})` },
            { id: 'episodes' as MemTab, label: `Episódios (${data.episodes.length})` },
            { id: 'facts' as MemTab, label: `Fatos (${data.facts.length})` },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.segBtn, active && { backgroundColor: colors.ink }]}
                onPress={() => {
                  hapticFeedback.selection();
                  setTab(t.id);
                }}
              >
                <Text
                  style={[
                    styles.segText,
                    { color: active ? colors.bg : colors.muted },
                    active && styles.segTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.ink} />
        ) : tab === 'themes' ? (
          data.themes.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              Nenhum resumo temático consolidado ainda.
            </Text>
          ) : (
            data.themes.map((t) => (
              <View key={t.id} style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
                <View style={styles.cardHd}>
                  <Text style={[styles.cardTitle, { color: colors.ink }]}>{t.theme_title}</Text>
                  <TouchableOpacity onPress={() => handleDeleteTheme(t.theme_slug)} hitSlop={8}>
                    <ProtoUiIcon name="delete-outline" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.cardBody, { color: colors.muted }]}>{t.consolidated_summary}</Text>
                <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.pillText, { color: colors.ink }]}>
                    {t.fact_count} fatos · {t.episode_count} episódios
                  </Text>
                </View>
              </View>
            ))
          )
        ) : tab === 'episodes' ? (
          data.episodes.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              Nenhum episódio registrado ainda.
            </Text>
          ) : (
            data.episodes.map((ep) => (
              <View key={ep.id} style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
                <View style={styles.cardHd}>
                  <Text style={[styles.cardTitle, { color: colors.ink }]}>{ep.title}</Text>
                  <TouchableOpacity onPress={() => handleDeleteEpisode(ep.id)} hitSlop={8}>
                    <ProtoUiIcon name="delete-outline" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.cardBody, { color: colors.muted }]}>{ep.narrative_summary}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.pillText, { color: colors.ink }]}>Canal: {ep.channel}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.pillText, { color: colors.ink }]}>Importância: {ep.importance}/5</Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : data.facts.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Nenhum fato atômico aprendido ainda.
          </Text>
        ) : (
          data.facts.map((f) => (
            <View key={f.id} style={[styles.factCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              <View style={styles.factCol}>
                <Text style={[styles.factCat, { color: colors.blue }]}>{f.category}</Text>
                <Text style={[styles.factText, { color: colors.ink }]}>{f.content}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteFact(f.id)} hitSlop={8}>
                <ProtoUiIcon name="delete-outline" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheetModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Novo fato ou preferência"
        subtitle="O Vito passa a considerar em todas as conversas"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.fieldLabel, { color: colors.ink }]}>Categoria</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink }]}
            value={factCat}
            onChangeText={setFactCat}
          />
          <Text style={[styles.fieldLabel, { color: colors.ink, marginTop: 12 }]}>
            O que o Vito deve lembrar?
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink }]}
            value={factText}
            onChangeText={setFactText}
            placeholder="Ex.: Não marcar reuniões às sextas depois das 16h"
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.ink }]}
            onPress={handleSaveFact}
          >
            <Text style={[styles.saveBtnText, { color: colors.bg }]}>Salvar na memória</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rb: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ttl: { flex: 1 },
  h1: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  sub: { fontSize: 12.5, marginTop: 1 },
  segWrap: { paddingHorizontal: 16, paddingTop: 12 },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: 'Geist_500Medium', fontSize: 13, fontVariant: ['tabular-nums'] },
  segTextActive: { fontFamily: 'Geist_600SemiBold' },
  content: { padding: 16, paddingBottom: 60, gap: 10 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  cardHd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  cardBody: { fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '500' },
  factCard: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  factCol: { flex: 1, gap: 3 },
  factCat: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase' },
  factText: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 14 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14.5 },
  saveBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14.5, fontWeight: '600' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontSize: 13, fontWeight: '600' },
});
