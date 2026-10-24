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
import { tokens } from '../../theme/tokens';
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
  const { colors } = useTheme();
  const [showPaused, setShowPaused] = useState(false);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Carregando suas vigílias...
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
      ListHeaderComponent={
        allCount > 0 ? (
          <View style={styles.sec}>
            <Text
              style={[
                styles.secTitle,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.montserratBold,
                },
              ]}
            >
              Ativos
            </Text>
            <Text style={[styles.cnt, { color: colors.muted }]}>
              {activeTriggers.length} de {allCount}
            </Text>
          </View>
        ) : null
      }
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
                  backgroundColor: colors.surf,
                  borderColor: colors.line,
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
                  color={colors.muted}
                />
                <Text style={[styles.pausedToggleText, { color: colors.muted }]}>
                  Pausados ({pausedTriggers.length})
                </Text>
              </View>
              <MaterialIcons
                name={showPaused ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.muted}
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
          tintColor={colors.ink}
        />
      }
      ListEmptyComponent={
        pausedTriggers.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: colors.surf,
                },
              ]}
            >
              <MaterialIcons
                name="radar"
                size={32}
                color={colors.muted}
              />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.montserratBold,
                },
              ]}
            >
              {selectedCategory === 'all'
                ? 'Nenhum radar ativo por enquanto'
                : 'Nenhum radar nesta categoria'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Digite acima o que você quer acompanhar ou explore por área para ativar com 1 toque.
            </Text>
            <TouchableOpacity
              style={[styles.emptyExploreButton, { backgroundColor: colors.ink }]}
              onPress={onExplorePress}
              activeOpacity={0.8}
            >
              <MaterialIcons name="auto-awesome" size={16} color={colors.bg} />
              <Text style={[styles.emptyExploreButtonText, { color: colors.bg }]}>
                Explorar por Área
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noActiveNote}>
            <Text style={[styles.noActiveNoteText, { color: colors.muted }]}>
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
    fontFamily: tokens.typography.family.regular,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  secTitle: {
    fontSize: 16,
  },
  cnt: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.medium,
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
    borderRadius: 14,
    borderWidth: 1,
  },
  pausedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pausedToggleText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
  },
  pausedListWrapper: {
    marginTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: tokens.typography.family.regular,
    marginBottom: 20,
  },
  emptyExploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyExploreButtonText: {
    fontSize: 13.5,
    fontFamily: tokens.typography.family.semibold,
  },
  noActiveNote: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noActiveNoteText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
  },
});
