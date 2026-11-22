import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MASCOT_PRESETS } from '../../data/botsCatalogFallback';
import { BotSkin } from '../../types/bots';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { BotMascotAvatar } from './BotMascotAvatar';

const COLOR_SWATCHES = [
  '#17191B',
  '#0B9A5F',
  '#2B7FD4',
  '#D6355A',
  '#D9681A',
  '#7A4FE0',
  '#0E8F9B',
  '#A8710A',
  '#475569',
  '#FFFFFF',
  '#DDF4E8',
  '#E4EFFB',
  '#FDE6EC',
  '#FBEBDB',
];

const PICKER_FIELDS: { key: keyof Omit<BotSkin, 'preset'>; label: string }[] = [
  { key: 'bodyColor', label: 'Corpo' },
  { key: 'bellyColor', label: 'Barriga e fundo' },
  { key: 'tentacleColor', label: 'Tentáculos' },
  { key: 'eyeColor', label: 'Olhos' },
  { key: 'cheekColor', label: 'Bochechas' },
  { key: 'accentColor', label: 'Antena e destaque' },
];

export interface MascotStudioModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialGoal?: string;
  initialCategory?: string;
  initialSkin?: BotSkin;
  onSave: (data: {
    title: string;
    goal: string;
    category: string;
    skin: BotSkin;
    skin_json: string;
  }) => Promise<void> | void;
}

export const MascotStudioModal: React.FC<MascotStudioModalProps> = ({
  visible,
  onClose,
  mode,
  initialTitle = '',
  initialGoal = '',
  initialCategory = 'Personalizado',
  initialSkin,
  onSave,
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState(initialTitle);
  const [goal, setGoal] = useState(initialGoal);
  const [category, setCategory] = useState(initialCategory);
  const [skin, setSkin] = useState<BotSkin>(initialSkin ?? MASCOT_PRESETS[0].skin);
  const [activeField, setActiveField] = useState<keyof Omit<BotSkin, 'preset'>>('bodyColor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initialTitle);
    setGoal(initialGoal);
    setCategory(initialCategory || 'Personalizado');
    setSkin(initialSkin ?? MASCOT_PRESETS[0].skin);
  }, [visible, initialTitle, initialGoal, initialCategory, initialSkin]);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        goal: goal.trim() || 'Ajudar na sua rotina diária.',
        category: category.trim() || 'Personalizado',
        skin,
        skin_json: JSON.stringify(skin),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={mode === 'create' ? 'Criar bot e mascote' : 'Aparência do bot'}
      subtitle="Escolha um preset ou personalize as 6 cores"
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.previewBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <BotMascotAvatar size={88} skin={skin} animState="happy" animated />
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>NOME DO BOT</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Caçador de voos"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            { backgroundColor: colors.surf, color: colors.ink, borderColor: colors.line },
          ]}
        />

        <Text style={[styles.label, { color: colors.muted }]}>FUNÇÃO (1 FRASE)</Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          placeholder="Ex: Acompanha preços e me avisa quando cair."
          placeholderTextColor={colors.muted}
          multiline
          style={[
            styles.input,
            styles.inputMulti,
            { backgroundColor: colors.surf, color: colors.ink, borderColor: colors.line },
          ]}
        />

        <Text style={[styles.label, { color: colors.muted }]}>10 PRESETS DE MASCOTE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {MASCOT_PRESETS.map((preset) => {
            const selected = skin.preset === preset.key;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.presetBtn,
                  {
                    backgroundColor: colors.surf,
                    borderColor: selected ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => setSkin(preset.skin)}
              >
                <BotMascotAvatar size={40} skin={preset.skin} animated={false} />
                <Text style={[styles.presetName, { color: colors.ink }]} numberOfLines={1}>
                  {preset.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.label, { color: colors.muted }]}>PERSONALIZAR 6 CORES</Text>
        <View style={styles.fieldsWrap}>
          {PICKER_FIELDS.map((f) => {
            const selected = activeField === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.fieldChip,
                  {
                    backgroundColor: selected ? colors.ink : colors.surf,
                    borderColor: selected ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => setActiveField(f.key)}
              >
                <View style={[styles.colorDot, { backgroundColor: skin[f.key] }]} />
                <Text
                  style={[
                    styles.fieldChipText,
                    { color: selected ? colors.bg : colors.ink },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.swatchesRow}>
          {COLOR_SWATCHES.map((hex) => {
            const isCurrent = skin[activeField].toLowerCase() === hex.toLowerCase();
            return (
              <TouchableOpacity
                key={hex}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: hex,
                    borderColor: isCurrent ? colors.ink : colors.line,
                    borderWidth: isCurrent ? 2.5 : 1,
                  },
                ]}
                onPress={() =>
                  setSkin((prev) => ({ ...prev, preset: undefined, [activeField]: hex }))
                }
              >
                {isCurrent && (
                  <MaterialIcons
                    name="check"
                    size={14}
                    color={hex === '#FFFFFF' || hex.startsWith('#D') || hex.startsWith('#E') || hex.startsWith('#F') ? '#17191B' : '#FFFFFF'}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: title.trim() ? colors.ink : colors.line },
          ]}
          onPress={handleSave}
          disabled={!title.trim() || saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.bg }]}>
            {saving ? 'Salvando...' : mode === 'create' ? 'Criar bot' : 'Salvar aparência'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  previewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  inputMulti: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  presetsRow: {
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    width: 78,
    gap: 4,
  },
  presetName: {
    fontSize: 10,
    fontWeight: '600',
  },
  fieldsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  fieldChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  swatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
