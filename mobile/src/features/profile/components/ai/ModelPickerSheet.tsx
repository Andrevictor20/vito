import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { BottomSheetModal } from '../../../../components/ui/BottomSheetModal';
import { useTheme } from '../../../../context/ThemeContext';
import { tokens } from '../../../../theme/tokens';
import {
  AI_PROVIDER_CATALOG,
  EFFORT_OPTIONS,
  getPickerViewModel,
} from '../../../../services/ai/aiProviderCatalog';
import type { AIProviderKey, ModelProviderGroup, ReasoningEffort } from '../../../../types/aiProviders';

export { getPickerViewModel };

export interface ModelPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  scopeLabel: 'Padrão do Vito' | 'Padrão deste bot' | 'Esta conversa';
  allowInherit: boolean;
  selectedModel: string | null | undefined;
  inheritedModel?: string | null;
  selectedEffort?: ReasoningEffort | null;
  groups: ModelProviderGroup[];
  onSelectModel: (modelValue: string | null) => void;
  onSelectEffort: (effort: ReasoningEffort) => void;
  onManageProviders: () => void;
}

export const ModelPickerSheet: React.FC<ModelPickerSheetProps> = ({
  visible,
  onClose,
  scopeLabel,
  allowInherit,
  selectedModel,
  inheritedModel,
  selectedEffort,
  groups,
  onSelectModel,
  onSelectEffort,
  onManageProviders,
}) => {
  const { colors } = useTheme();
  const vm = getPickerViewModel({ groups, selectedModel, inheritedModel, allowInherit });
  const activeEffort: ReasoningEffort = selectedEffort || 'auto';

  const [activeProviderTab, setActiveProviderTab] = useState<'all' | AIProviderKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setActiveProviderTab('all');
    }
  }, [visible]);

  const totalModels = useMemo(
    () => vm.connectedGroups.reduce((acc, g) => acc + g.models.length, 0),
    [vm.connectedGroups]
  );

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vm.connectedGroups
      .filter((g) => activeProviderTab === 'all' || g.provider_key === activeProviderTab)
      .map((g) => ({
        ...g,
        models: q
          ? g.models.filter(
              (m) =>
                m.name.toLowerCase().includes(q) ||
                m.id.toLowerCase().includes(q) ||
                g.name.toLowerCase().includes(q)
            )
          : g.models,
      }))
      .filter((g) => g.models.length > 0);
  }, [vm.connectedGroups, activeProviderTab, searchQuery]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Modelo" subtitle={scopeLabel}>
      {totalModels > 5 && (
        <View style={[styles.searchBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <ProtoUiIcon name="search" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.ink }]}
            placeholder="Buscar modelo…"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={tokens.hitSlop.sm}>
              <ProtoUiIcon name="close" size={15} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {vm.connectedGroups.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroll}
        >
          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: activeProviderTab === 'all' ? colors.ink : colors.surf,
                borderColor: activeProviderTab === 'all' ? colors.ink : colors.line,
              },
            ]}
            onPress={() => setActiveProviderTab('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabChipText, { color: activeProviderTab === 'all' ? colors.bg : colors.ink }]}>
              Todos ({totalModels})
            </Text>
          </TouchableOpacity>
          {vm.connectedGroups.map((g) => {
            const active = activeProviderTab === g.provider_key;
            const accent = AI_PROVIDER_CATALOG[g.provider_key]?.accentColor || colors.ink;
            return (
              <TouchableOpacity
                key={g.provider_key}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => setActiveProviderTab(g.provider_key)}
                activeOpacity={0.75}
              >
                <View style={[styles.tabDot, { backgroundColor: active ? colors.bg : accent }]} />
                <Text style={[styles.tabChipText, { color: active ? colors.bg : colors.ink }]}>
                  {g.name} ({g.models.length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {allowInherit && !searchQuery.trim() && activeProviderTab === 'all' && (
          <TouchableOpacity
            style={[
              styles.inheritRow,
              {
                backgroundColor: colors.surf,
                borderColor: !vm.hasExplicitValidSelection ? colors.ink : colors.line,
              },
            ]}
            onPress={() => {
              onSelectModel(null);
              onClose();
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.dot, { backgroundColor: colors.ink }]} />
            <View style={styles.pickInfo}>
              <Text style={[styles.pickTitle, { color: colors.ink }]} numberOfLines={1}>
                Padrão ({vm.inheritedResolved.model.name})
              </Text>
              <Text style={[styles.pickSub, { color: colors.muted }]} numberOfLines={1}>
                Segue a configuração mais geral
              </Text>
            </View>
            {!vm.hasExplicitValidSelection && (
              <ProtoUiIcon name="check" size={16} color={colors.ink} />
            )}
          </TouchableOpacity>
        )}

        {visibleGroups.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhum modelo encontrado para "{searchQuery.trim()}".
          </Text>
        ) : (
          visibleGroups.map((group) => {
            const accent = AI_PROVIDER_CATALOG[group.provider_key]?.accentColor || colors.ink;
            const isCollapsed = activeProviderTab === 'all' && !searchQuery.trim() && Boolean(collapsedGroups[group.provider_key]);
            return (
              <View key={group.provider_key} style={styles.groupWrap}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => activeProviderTab === 'all' && toggleGroup(group.provider_key)}
                  activeOpacity={activeProviderTab === 'all' ? 0.7 : 1}
                >
                  <View style={styles.groupHeaderLeft}>
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    <Text style={[styles.groupLabel, { color: colors.muted }]}>
                      {group.name.toUpperCase()}
                    </Text>
                    <Text style={[styles.groupCount, { color: colors.muted }]}>
                      · {group.models.length}
                    </Text>
                  </View>
                  {activeProviderTab === 'all' && (
                    <ProtoUiIcon
                      name={isCollapsed ? 'chevron-right' : 'expand-more'}
                      size={16}
                      color={colors.muted}
                    />
                  )}
                </TouchableOpacity>

                {!isCollapsed && (
                  <View style={[styles.groupCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
                    {group.models.map((model, idx) => {
                      const value = `${group.provider_key}:${model.id}`;
                      const isSelected = allowInherit
                        ? vm.hasExplicitValidSelection && selectedModel === value
                        : vm.effective.value === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.compactRow,
                            idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                            isSelected && { backgroundColor: colors.bg },
                          ]}
                          onPress={() => {
                            onSelectModel(value);
                            onClose();
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={styles.pickInfo}>
                            <Text style={[styles.pickTitle, { color: colors.ink }]} numberOfLines={1}>
                              {model.name}
                            </Text>
                            {(model.reasoning || model.supports_vision || group.provider_key === 'srv') && (
                              <View style={styles.metaRow}>
                                {group.provider_key === 'srv' && !!model.note && (
                                  <Text style={[styles.pickSub, { color: colors.muted }]} numberOfLines={1}>
                                    {model.note}
                                  </Text>
                                )}
                                {model.reasoning && (
                                  <Text style={[styles.capTag, { color: colors.muted, borderColor: colors.line }]}>
                                    Raciocínio
                                  </Text>
                                )}
                                {model.supports_vision && group.provider_key !== 'srv' && (
                                  <Text style={[styles.capTag, { color: colors.muted, borderColor: colors.line }]}>
                                    Visão
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                          {isSelected && <ProtoUiIcon name="check" size={16} color={accent} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}

        {vm.showReasoningSelector && (
          <View style={styles.effortSection}>
            <Text style={[styles.groupLabel, { color: colors.muted, marginBottom: 6 }]}>RACIOCÍNIO</Text>
            <View style={[styles.effortSeg, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              {EFFORT_OPTIONS.map((opt) => {
                const active = activeEffort === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.effortBtn,
                      active && { backgroundColor: colors.ink },
                    ]}
                    onPress={() => onSelectEffort(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.effortText,
                        { color: active ? colors.bg : colors.ink },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.footerBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => {
            onClose();
            onManageProviders();
          }}
          activeOpacity={0.75}
        >
          <Text style={[styles.footerBtnText, { color: colors.ink }]}>Gerenciar provedores</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 38,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 13.5, paddingVertical: 6 },
  tabsScroll: { flexGrow: 0, marginBottom: 8 },
  tabsRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabChipText: { fontSize: 12, fontWeight: '600' },
  scroll: { maxHeight: 420 },
  inheritRow: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  groupWrap: { marginTop: 10 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  groupCount: { fontSize: 11, fontWeight: '600' },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  compactRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  pickInfo: { flex: 1, minWidth: 0 },
  pickTitle: { fontSize: 13.5, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pickSub: { fontSize: 11.5 },
  capTag: {
    fontSize: 10,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  effortSection: { marginTop: 12 },
  effortSeg: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  effortBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortText: { fontSize: 12.5, fontWeight: '600' },
  footerBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  footerBtnText: { fontSize: 13.5, fontWeight: '600', fontFamily: tokens.typography.family.semibold },
});
