import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import {
  AI_PROVIDER_CATALOG,
  EFFORT_OPTIONS,
  getPickerViewModel,
} from '../../services/ai/aiProviderCatalog';
import type { ModelProviderGroup, ReasoningEffort } from '../../types/aiProviders';

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

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Modelo" subtitle={scopeLabel}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {allowInherit && (
          <TouchableOpacity
            style={[
              styles.pickRow,
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
              <Text style={[styles.pickTitle, { color: colors.ink }]}>
                Padrão ({vm.inheritedResolved.model.name})
              </Text>
              <Text style={[styles.pickSub, { color: colors.muted }]}>
                Segue a configuração mais geral
              </Text>
            </View>
            {!vm.hasExplicitValidSelection && (
              <MaterialIcons name="check" size={18} color={colors.ink} />
            )}
          </TouchableOpacity>
        )}

        {vm.connectedGroups.map((group) => {
          const accent = AI_PROVIDER_CATALOG[group.provider_key]?.accentColor || colors.ink;
          return (
            <View key={group.provider_key} style={styles.groupWrap}>
              <Text style={[styles.groupLabel, { color: colors.muted }]}>
                {group.name.toUpperCase()}
              </Text>
              {group.models.map((model) => {
                const value = `${group.provider_key}:${model.id}`;
                const isSelected = allowInherit
                  ? vm.hasExplicitValidSelection && selectedModel === value
                  : vm.effective.value === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickRow,
                      {
                        backgroundColor: colors.surf,
                        borderColor: isSelected ? accent : colors.line,
                      },
                    ]}
                    onPress={() => {
                      onSelectModel(value);
                      onClose();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    <View style={styles.pickInfo}>
                      <Text style={[styles.pickTitle, { color: colors.ink }]}>{model.name}</Text>
                      <Text style={[styles.pickSub, { color: colors.muted }]}>
                        {(model.note || 'Modelo disponível') + (model.reasoning ? ' · raciocínio' : '')}
                      </Text>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={18} color={accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {vm.showReasoningSelector && (
          <View style={styles.effortSection}>
            <Text style={[styles.groupLabel, { color: colors.muted }]}>RACIOCÍNIO</Text>
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
  scroll: { maxHeight: 460 },
  groupWrap: { marginTop: 12 },
  groupLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  pickRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  pickInfo: { flex: 1 },
  pickTitle: { fontSize: 14, fontWeight: '600' },
  pickSub: { fontSize: 12, marginTop: 2 },
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
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortText: { fontSize: 12.5, fontWeight: '600' },
  footerBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  footerBtnText: { fontSize: 14, fontWeight: '600', fontFamily: tokens.typography.family.semibold },
});
