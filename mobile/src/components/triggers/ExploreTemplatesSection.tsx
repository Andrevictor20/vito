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
import { tokens } from '../../theme/tokens';
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
  { id: 'travel', label: 'Voos & Viagens', category: 'travel', icon: 'flight' },
  { id: 'shopping', label: 'Preços & Ofertas', category: 'shopping', icon: 'local-offer' },
  { id: 'public_exams', label: 'Concursos & Editais', category: 'public_exams', icon: 'description' },
  { id: 'finance', label: 'Faturas & Boletos', category: 'finance', icon: 'receipt' },
  { id: 'news', label: 'Notícias', category: 'news', icon: 'article' },
  { id: 'events_sports', label: 'Eventos & Jogos', category: 'events_sports', icon: 'sports-soccer' },
];

const DEFAULT_TEMPLATES: TriggerTemplate[] = [
  {
    id: 'tpl_flights',
    title: 'Voos e passagens',
    description: 'Avisa quando o preço cair',
    category: 'travel',
    area: 'travel',
    icon: 'flight',
    connectors: ['web'],
    query: 'Passagens aéreas em promoção',
    user_intent: 'Monitorar preço de passagens',
    condition_type: 'price_below',
    target_value: '600',
    frequency: 'daily_morning',
  },
  {
    id: 'tpl_prices',
    title: 'Preços e ofertas',
    description: 'Acompanha produtos e promoções',
    category: 'shopping',
    area: 'shopping',
    icon: 'local-offer',
    connectors: ['web'],
    query: 'Monitoramento de ofertas',
    user_intent: 'Alerta de redução de preço',
    condition_type: 'price_below',
    target_value: '0',
    frequency: 'daily_morning',
  },
  {
    id: 'tpl_exams',
    title: 'Concursos e editais',
    description: 'Novos editais da sua área',
    category: 'public_exams',
    area: 'public_exams',
    icon: 'description',
    connectors: ['web'],
    query: 'Novos concursos públicos e editais abertos',
    user_intent: 'Notificar sobre novos editais',
    condition_type: 'change_detected',
    target_value: '',
    frequency: 'daily_morning',
  },
  {
    id: 'tpl_bills',
    title: 'Faturas e boletos',
    description: 'Vencimentos vindos dos seus e-mails',
    category: 'finance',
    area: 'finance',
    icon: 'receipt',
    connectors: ['gmail'],
    query: 'Faturas de cartão e boletos a vencer',
    user_intent: 'Lembrar de pagamentos',
    condition_type: 'event_upcoming',
    target_value: '',
    frequency: 'daily_morning',
  },
  {
    id: 'tpl_news',
    title: 'Notícias',
    description: 'Resumo diário de um assunto',
    category: 'news',
    area: 'news',
    icon: 'article',
    connectors: ['web'],
    query: 'Resumo diário de notícias sobre tecnologia e negócios',
    user_intent: 'Briefing diário de notícias',
    condition_type: 'daily_brief',
    target_value: '',
    frequency: 'daily_morning',
  },
  {
    id: 'tpl_sports',
    title: 'Eventos e jogos',
    description: 'Datas e horários do seu time',
    category: 'events_sports',
    area: 'events_sports',
    icon: 'sports-soccer',
    connectors: ['web'],
    query: 'Próximos jogos do Flamengo e horários',
    user_intent: 'Acompanhar jogos e transmissões',
    condition_type: 'event_upcoming',
    target_value: '',
    frequency: 'daily_morning',
  },
];

export const ExploreTemplatesSection: React.FC<ExploreTemplatesSectionProps> = ({
  onActivate,
  activatingId,
}) => {
  const { colors } = useTheme();
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
      if (data && data.length > 0) {
        setTemplates(data);
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch (err: any) {
      console.warn('[ExploreTemplatesSection] Usando catálogo padrão:', err?.message);
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    const list = templates.length > 0 ? templates : DEFAULT_TEMPLATES;
    if (selectedFilter === 'all') return list;
    return list.filter((t) => {
      const option = CATEGORY_FILTERS.find((f) => f.id === selectedFilter);
      if (!option || !option.category) return true;
      return t.category === option.category || t.area === selectedFilter;
    });
  }, [templates, selectedFilter]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Carregando catálogo de vigílias...
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
                    backgroundColor: isSelected ? colors.ink : colors.surf,
                    borderColor: isSelected ? colors.ink : colors.line,
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
                  color={isSelected ? colors.bg : colors.muted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? colors.bg : colors.ink,
                      fontFamily: isSelected
                        ? tokens.typography.family.semibold
                        : tokens.typography.family.medium,
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

      {/* Grid de 2 colunas .tiles com cards .tile */}
      <FlatList
        data={filteredTemplates}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTemplates(true)}
            tintColor={colors.ink}
          />
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
            <MaterialIcons name="search-off" size={40} color={colors.muted} />
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.montserratBold,
                },
              ]}
            >
              Nenhuma vigília nesta área
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Escolha outra categoria acima ou digite o que quer acompanhar.
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
    fontFamily: tokens.typography.family.regular,
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
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  filterPillText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 11,
    paddingTop: 4,
    paddingBottom: 120,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
    fontFamily: tokens.typography.family.regular,
  },
});
