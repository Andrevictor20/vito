import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { api } from '../../services/api';
import { MemoriesApi, MemoriesResponse } from '../../services/api/memoriesApi';

interface UserMemoriesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserMemoriesModal: React.FC<UserMemoriesModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const [data, setData] = useState<MemoriesResponse>({ themes: [], episodes: [], facts: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'themes' | 'episodes' | 'facts'>('themes');

  const memoriesClient = new MemoriesApi(api);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const res = await memoriesClient.listMemories();
      setData(res || { themes: [], episodes: [], facts: [] });
    } catch (err) {
      console.warn('[UserMemoriesModal] Erro ao carregar memórias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchMemories();
    }
  }, [visible]);

  const handleDeleteTheme = (slug: string) => {
    Alert.alert('Esquecer Tema', 'Deseja realmente remover esta consolidação temática?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await memoriesClient.deleteThematicSummary(slug);
            setData((prev) => ({
              ...prev,
              themes: prev.themes.filter((t) => t.theme_slug !== slug),
            }));
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível remover o tema.');
          }
        },
      },
    ]);
  };

  const handleDeleteEpisode = (id: string) => {
    Alert.alert('Esquecer Episódio', 'Deseja remover este episódio da memória?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await memoriesClient.deleteEpisode(id);
            setData((prev) => ({
              ...prev,
              episodes: prev.episodes.filter((e) => e.id !== id),
            }));
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível remover o episódio.');
          }
        },
      },
    ]);
  };

  const handleDeleteFact = (id: string) => {
    Alert.alert('Esquecer Fato', 'Deseja desativar este fato aprendido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await memoriesClient.deleteFact(id);
            setData((prev) => ({
              ...prev,
              facts: prev.facts.filter((f) => f.id !== id),
            }));
          } catch (err) {
            Alert.alert('Erro', 'Não foi possível remover o fato.');
          }
        },
      },
    ]);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="O que o Vito sabe sobre mim"
      subtitle="Memórias de longo prazo, fatos e rotinas aprendidas"
    >
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'themes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('themes')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'themes' ? colors.primary : colors.onSurfaceVariant },
            ]}
          >
            Temas ({data.themes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'episodes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('episodes')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'episodes' ? colors.primary : colors.onSurfaceVariant },
            ]}
          >
            Episódios ({data.episodes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'facts' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('facts')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'facts' ? colors.primary : colors.onSurfaceVariant },
            ]}
          >
            Fatos ({data.facts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
            Carregando memórias...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'themes' && (
            <>
              {data.themes.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                  Nenhum resumo temático consolidado ainda.
                </Text>
              ) : (
                data.themes.map((th) => (
                  <View
                    key={th.id}
                    style={[
                      styles.card,
                      { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                        {th.theme_title}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteTheme(th.theme_slug)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.cardBody, { color: colors.onSurfaceVariant }]}>
                      {th.consolidated_summary}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.outline }]}>
                      {th.fact_count} fatos · {th.episode_count} episódios consolidados
                    </Text>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'episodes' && (
            <>
              {data.episodes.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                  Nenhum episódio registrado ainda.
                </Text>
              ) : (
                data.episodes.map((ep) => (
                  <View
                    key={ep.id}
                    style={[
                      styles.card,
                      { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{ep.title}</Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteEpisode(ep.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.cardBody, { color: colors.onSurfaceVariant }]}>
                      {ep.narrative_summary}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.outline }]}>
                      Canal: {ep.channel} · Importância: {ep.importance}/5
                    </Text>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'facts' && (
            <>
              {data.facts.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                  Nenhum fato atômico aprendido ainda.
                </Text>
              ) : (
                data.facts.map((fc) => (
                  <View
                    key={fc.id}
                    style={[
                      styles.factRow,
                      { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <View style={styles.factTextContainer}>
                      <Text style={[styles.factCategory, { color: colors.primary }]}>
                        [{fc.category}]
                      </Text>
                      <Text style={[styles.factContent, { color: colors.onSurface }]}>
                        {fc.content}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteFact(fc.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: tokens.spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: tokens.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: tokens.spacing.xl,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  loadingText: {
    fontSize: tokens.typography.bodySmall.fontSize,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: tokens.spacing.xl,
    fontSize: tokens.typography.bodySmall.fontSize,
  },
  card: {
    padding: tokens.spacing.md,
    borderRadius: tokens.shapes.md,
    borderWidth: 1,
    gap: tokens.spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: tokens.typography.titleSmall.fontSize,
    fontWeight: '700',
    flex: 1,
  },
  cardBody: {
    fontSize: tokens.typography.bodySmall.fontSize,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 11,
    marginTop: tokens.spacing['2xs'],
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.sm,
    borderRadius: tokens.shapes.sm,
    borderWidth: 1,
  },
  factTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: tokens.spacing.xs,
    paddingRight: tokens.spacing.sm,
  },
  factCategory: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  factContent: {
    fontSize: tokens.typography.bodySmall.fontSize,
    flex: 1,
  },
});
