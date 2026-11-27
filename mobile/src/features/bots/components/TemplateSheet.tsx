import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { MASCOT_PRESETS } from '../data/botsCatalogFallback';
import { BotAppInfo, BotSkin, BotTemplate } from '../types/bots';
import { VitoSheet } from '../../../components/ui/VitoSheet';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface TemplateSheetProps {
  visible: boolean;
  template: BotTemplate | null;
  apps: BotAppInfo[];
  onClose: () => void;
  onActivate: (template: BotTemplate, skin: BotSkin) => Promise<void>;
  onCustomizeMascot: (template: BotTemplate, skin: BotSkin) => void;
}

export const TemplateSheet: React.FC<TemplateSheetProps> = ({
  visible,
  template,
  apps,
  onClose,
  onActivate,
  onCustomizeMascot,
}) => {
  const { colors } = useTheme();
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [activating, setActivating] = useState(false);

  if (!template) return null;

  const activeSkin = MASCOT_PRESETS[selectedPresetIdx]?.skin ?? MASCOT_PRESETS[0].skin;
  const templateActions = template.actions ?? ['notify'];
  const missingApps = (apps ?? []).filter((app) => {
    if (app?.connected) return false;
    const appActions = Array.isArray(app?.actions) ? app.actions : [];
    return appActions.some((a) => templateActions.includes(a.action_key));
  });

  const handleActivate = async () => {
    if (activating) return;
    setActivating(true);
    try {
      await onActivate(template, activeSkin);
      onClose();
    } finally {
      setActivating(false);
    }
  };

  return (
    <VitoSheet
      visible={visible}
      onClose={onClose}
      title={template.name}
      subtitle={template.category}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.previewRow, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <BotMascotAvatar size={64} skin={activeSkin} animState="idle" animated />
          <View style={styles.previewCol}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>FUNÇÃO</Text>
            <Text style={[styles.goalText, { color: colors.ink }]}>{template.goal}</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ESCOLHA O MASCOTE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {MASCOT_PRESETS.slice(0, 6).map((preset, idx) => (
            <TouchableOpacity
              key={preset.key}
              style={[
                styles.presetDot,
                {
                  borderColor: selectedPresetIdx === idx ? colors.ink : colors.line,
                  backgroundColor: colors.surf,
                },
              ]}
              onPress={() => setSelectedPresetIdx(idx)}
            >
              <BotMascotAvatar size={36} skin={preset.skin} animated={false} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.customizeBtn, { borderColor: colors.line }]}
          onPress={() => {
            onClose();
            onCustomizeMascot(template, activeSkin);
          }}
        >
          <ProtoUiIcon name="palette" size={16} color={colors.ink} />
          <Text style={[styles.customizeText, { color: colors.ink }]}>
            Personalizar cores do bot
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>HABILIDADES INCLUÍDAS</Text>
        <View style={styles.tagsRow}>
          {(template.skills ?? []).map((sk) => (
            <View key={sk} style={[styles.tag, { backgroundColor: colors.surf }]}>
              <Text style={[styles.tagText, { color: colors.ink }]}>{sk}</Text>
            </View>
          ))}
        </View>

        {missingApps.length > 0 && (
          <View
            style={[
              styles.warnBox,
              { backgroundColor: colors.orangeBg, borderColor: colors.orange },
            ]}
          >
            <ProtoUiIcon name="info-outline" size={16} color={colors.orange} />
            <Text style={[styles.warnText, { color: colors.ink }]}>
              Dá para ativar agora. As ações de {missingApps.map((a) => a.name).join(' e ')} ficam
              travadas até você conectar o app em Perfil › Integrações.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.activateBtn, { backgroundColor: colors.ink }]}
          onPress={handleActivate}
          disabled={activating}
        >
          <Text style={[styles.activateBtnText, { color: colors.bg }]}>
            {activating ? 'Ativando...' : 'Ativar bot'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { maxHeight: 480 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewCol: { flex: 1, gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 },
  goalText: { fontSize: 13, lineHeight: 18 },
  presetsRow: { gap: 8, marginBottom: 10 },
  presetDot: {
    padding: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  customizeText: { fontSize: 12, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '600' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  warnText: { flex: 1, fontSize: 12, lineHeight: 17 },
  activateBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 6,
  },
  activateBtnText: { fontSize: 14, fontWeight: '700' },
});
