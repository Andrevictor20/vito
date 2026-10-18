import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TriggerTemplate, TriggerCategory } from '../../types';
import { api } from '../../services/api';
import { TemplateCard } from './TemplateCard';

interface ExploreTemplatesSectionProps {
  onActivate: (template: TriggerTemplate) => Promise<void>;
  activatingId?: string | null;
}

interface CategoryFilterOption {
  id: string;
  label: string;
  category?: TriggerCategory;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const CATEGORY_FILTERS: CategoryFilterOption[] = [
  { id: 'all', label: 'Todas', icon: 'auto-awesome' },
  { id: 'career', label: 'Carreiras', category: 'career', icon: 'work-outline' },
  { id: 'public_exams', label: 'Concursos', category: 'public_exams', icon: 'gavel' },
  { id: 'real_estate', label: 'Imóveis', category: 'real_estate', icon: 'apartment' },
  { id: 'finance', label: 'Finanças', category: 'finance', icon: 'trending-up' },
  { id: 'travel', label: 'Viagens', category: 'travel', icon: 'flight' },
  { id: 'news', label: 'Trabalho & Setor', category: 'news', icon: 'newspaper' },
  { id: 'tech', label: 'Estudos', category: 'tech', icon: 'school' },
];

export const ExploreTemplatesSection: React.FC<ExploreTemplatesSectionProps> = ({
  onActivate,
  activatingId,
}) => {
  const { colors, isDark } = useTheme();
  const [templates, setTemplates] = useState<TriggerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await api.getTriggerTemplates();
      setTemplates(data);
    } catch (err: any) {
      console.error('[ExploreTemplatesSection] Erro ao carregar templates:', err);
      setErrorMessage(err?.message || 'Falha ao carregar catálogo de vigílias.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    if (selectedFilter === 'all') return templates;
    return templates.filter((t) => {
      const option = CATEGORY_FILTERS.find((f) => f.id === selectedFilter);
      if (!option || !option.category) return true;
      return t.category === option.category || t.area === selectedFilter;
    });
  }, [templates, selectedFilter]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
          Carregando catálogo de vigílias proativas...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtros em Pílulas Horizontais */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {CATEGORY_FILTERS.map((filter) => {
            const isSelected = selectedFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isDark
                      ? colors.surfaceContainerLow
                      : '#F4F4F5',
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  },
                ]}
                onPress={() => setSelectedFilter(filter.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Filtrar por ${filter.label}`}
              >
                <MaterialIcons
                  name={filter.icon}
                  size={14}
                  color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? colors.onPrimary : colors.onSurface,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista de Templates de Vigília */}
      <FlatList
        data={filteredTemplates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTemplates(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View
            style={[
              styles.heroBanner,
              {
                backgroundColor: isDark ? colors.surfaceContainerLow : '#F8FAFC',
                borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View style={styles.heroBannerHeader}>
              <View
                style={[
                  styles.heroBannerIconWrap,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF' },
                ]}
              >
                <MaterialIcons name="radar" size={20} color={colors.primary} />
              </View>
              <View style={styles.heroBannerTextCol}>
                <Text style={[styles.heroBannerTitle, { color: colors.onSurface }]}>
                  Vigílias Inteligentes & Proativas
                </Text>
                <Text style={[styles.heroBannerSubtitle, { color: colors.onSurfaceVariant }]}>
                  Ative monitores com 1 toque. O Vito cruza suas fontes e te avisa no WhatsApp e no app antes de você precisar perguntar.
                </Text>
              </View>
            </View>
            {!!errorMessage && (
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            isActivating={activatingId === item.id}
            onActivate={onActivate}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={40} color={colors.onSurfaceVariant} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              Nenhuma vigília nesta área
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Escolha outra categoria acima ou crie uma personalizada pelo campo de busca.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  filterSection: {
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    gap: 6,
  },
  filterPillText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 14,
  },
  heroBanner: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: 14,
    marginBottom: 6,
  },
  heroBannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBannerTextCol: {
    flex: 1,
  },
  heroBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroBannerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
});
