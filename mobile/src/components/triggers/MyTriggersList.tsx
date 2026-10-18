import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TriggerCategory } from '../../types';
import { TriggerCard } from './TriggerCard';

interface MyTriggersListProps {
  activeTriggers: Trigger[];
  pausedTriggers: Trigger[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  selectedCategory: TriggerCategory | 'all';
  onToggle: (id: string) => Promise<void>;
  onPress: (trigger: Trigger) => void;
  onExplorePress: () => void;
}

export const MyTriggersList: React.FC<MyTriggersListProps> = ({
  activeTriggers,
  pausedTriggers,
  loading,
  refreshing,
  onRefresh,
  selectedCategory,
  onToggle,
  onPress,
  onExplorePress,
}) => {
  const { colors, isDark } = useTheme();
  const [showPaused, setShowPaused] = useState(false);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
          Atualizando seus radares...
        </Text>
      </View>
    );
  }

  const allCount = activeTriggers.length + pausedTriggers.length;

  return (
    <FlatList
      data={activeTriggers}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TriggerCard
          trigger={item}
          onToggle={onToggle}
          onPress={onPress}
        />
      )}
      ListFooterComponent={
        pausedTriggers.length > 0 ? (
          <View style={styles.pausedSectionWrapper}>
            <TouchableOpacity
              style={[
                styles.pausedSectionToggle,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => setShowPaused(!showPaused)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Alternar visualização de radares pausados"
            >
              <View style={styles.pausedToggleLeft}>
                <MaterialIcons
                  name="pause-circle-outline"
                  size={16}
                  color={colors.onSurfaceVariant}
                />
                <Text style={[styles.pausedToggleText, { color: colors.onSurfaceVariant }]}>
                  Pausados ({pausedTriggers.length})
                </Text>
              </View>
              <MaterialIcons
                name={showPaused ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {showPaused && (
              <View style={styles.pausedListWrapper}>
                {pausedTriggers.map((item) => (
                  <TriggerCard
                    key={item.id}
                    trigger={item}
                    onToggle={onToggle}
                    onPress={onPress}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null
      }
      contentContainerStyle={[
        styles.listContent,
        allCount === 0 && styles.listEmptyContent,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        pausedTriggers.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <MaterialIcons
                name="radar"
                size={32}
                color={isDark ? '#71717A' : '#9CA3AF'}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              {selectedCategory === 'all'
                ? 'Nenhum radar ativo por enquanto'
                : 'Nenhum radar nesta categoria'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Digite acima o que você quer acompanhar ou toque em "Explore por Área" para ativar com 1 toque.
            </Text>
            <TouchableOpacity
              style={[styles.emptyExploreButton, { backgroundColor: colors.primaryContainer }]}
              onPress={onExplorePress}
              activeOpacity={0.8}
            >
              <MaterialIcons name="auto-awesome" size={16} color={colors.onPrimaryContainer} />
              <Text style={[styles.emptyExploreButtonText, { color: colors.onPrimaryContainer }]}>
                Ver Sugestões por Área
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noActiveNote}>
            <Text style={[styles.noActiveNoteText, { color: colors.onSurfaceVariant }]}>
              Nenhum radar ativo no momento. Veja os pausados abaixo.
            </Text>
          </View>
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  pausedSectionWrapper: {
    marginTop: 12,
    marginBottom: 8,
  },
  pausedSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  pausedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pausedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pausedListWrapper: {
    marginTop: 8,
  },
  noActiveNote: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noActiveNoteText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyExploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: MD3Shapes.medium,
    marginTop: 12,
    gap: 6,
  },
  emptyExploreButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
