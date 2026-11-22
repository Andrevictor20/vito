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
import { BotSkin } from '../../types/bots';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { MascotVectorRig } from '../mascot/MascotVectorRig';
import {
  MASCOT_PRESETS,
  MascotPart,
  pickRandomMascotPreset,
  presetById,
  resolveSkin,
} from '../mascot/mascotPalettes';

const COLOR_SWATCHES = [
  '#FFFFFF',
  '#F5F5F5',
  '#171717',
  '#0A0A0A',
  '#FF3B30',
  '#00F5D4',
  '#FF2A85',
  '#0369A1',
  '#F43F5E',
  '#581C87',
  '#D97706',
  '#10B981',
  '#EAB308',
  '#818CF8',
];

const PICKER_FIELDS: { key: keyof Omit<BotSkin, 'preset'>; label: string }[] = [
  { key: 'fill', label: 'Corpo' },
  { key: 'stroke', label: 'Contorno' },
  { key: 'eyes', label: 'Olhos' },
  { key: 'bowtie', label: 'Gravata' },
  { key: 'hat', label: 'Chapéu' },
  { key: 'band', label: 'Fita chapéu' },
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
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState(initialTitle);
  const [goal, setGoal] = useState(initialGoal);
  const [category, setCategory] = useState(initialCategory);
  const [skin, setSkin] = useState<BotSkin>(initialSkin ?? MASCOT_PRESETS[1]);
  const [darkStage, setDarkStage] = useState<boolean>(isDark);
  const [reaction, setReaction] = useState<MascotPart | null>(null);
  const [lastRandomName, setLastRandomName] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<keyof Omit<BotSkin, 'preset'>>('fill');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const baseSkin = initialSkin ?? MASCOT_PRESETS[1];
    setTitle(initialTitle);
    setGoal(initialGoal);
    setCategory(initialCategory || 'Personalizado');
    setSkin(baseSkin);
    setDarkStage(isDark || presetById(baseSkin.preset).darkStage);
    setLastRandomName(null);
    setReaction(null);
  }, [visible, initialTitle, initialGoal, initialCategory, initialSkin, isDark]);

  const activePreset = presetById(skin.preset);
  const resolved = resolveSkin(skin, darkStage);
  const badgeLabel =
    skin.preset === 'custom' ? lastRandomName || 'Personalizado' : activePreset.name;

  const handleRandomize = () => {
    const pick = pickRandomMascotPreset(skin.preset);
    setSkin({
      preset: pick.preset,
      fill: pick.fill,
      stroke: pick.stroke,
      eyes: pick.eyes,
      bowtie: pick.bowtie,
      hat: pick.hat,
      band: pick.band,
    });
    setLastRandomName(pick.preset === 'custom' ? pick.name : null);
    setDarkStage(pick.darkStage);
  };

  const handleTestReaction = () => {
    const options: MascotPart[] = ['hat', 'bowtie', 'eyes'];
    const next = options[Math.floor(Math.random() * options.length)];
    setReaction(null);
    setTimeout(() => setReaction(next), 10);
  };

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

  const stageBg = darkStage ? '#0F1318' : colors.surf;
  const stageInk = darkStage ? '#F5F5F5' : colors.ink;
  const stageBadgeBg = darkStage ? 'rgba(255,255,255,0.12)' : colors.bg;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={mode === 'create' ? 'Criar bot e mascote' : 'Aparência do bot'}
      subtitle="Escolha um preset ou personalize as 6 cores"
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.stageBox, { backgroundColor: stageBg, borderColor: colors.line }]}>
          <View style={styles.stageTop}>
            <View style={[styles.stagePill, { backgroundColor: stageBadgeBg }]}>
              <Text style={[styles.stagePillText, { color: stageInk }]}>{badgeLabel}</Text>
            </View>
            <View style={styles.stageTopRight}>
              <TouchableOpacity
                style={[styles.stagePill, { backgroundColor: stageBadgeBg }]}
                onPress={handleRandomize}
                accessibilityLabel="Sortear estilo"
              >
                <MaterialIcons name="shuffle" size={13} color={stageInk} />
                <Text style={[styles.stagePillText, { color: stageInk }]}>Sortear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stagePill, { backgroundColor: stageBadgeBg }]}
                onPress={() => setDarkStage((v) => !v)}
              >
                <MaterialIcons
                  name={darkStage ? 'dark-mode' : 'light-mode'}
                  size={13}
                  color={stageInk}
                />
                <Text style={[styles.stagePillText, { color: stageInk }]}>
                  {darkStage ? 'Fundo escuro' : 'Fundo claro'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rigWrap}>
            <MascotVectorRig
              size={136}
              skin={skin}
              state="idle"
              animated={true}
              darkStage={darkStage}
              reaction={reaction}
              interactiveParts={true}
            />
          </View>

          <TouchableOpacity
            style={[styles.reactBtn, { backgroundColor: stageBadgeBg }]}
            onPress={handleTestReaction}
          >
            <Text style={[styles.reactBtnText, { color: stageInk }]}>Testar reação</Text>
          </TouchableOpacity>
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

        <Text style={[styles.label, { color: colors.muted }]}>PRESETS DE CORES (10)</Text>
        <View style={styles.presetsGrid}>
          {MASCOT_PRESETS.map((preset) => {
            const selected = skin.preset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetBtn,
                  {
                    backgroundColor: selected ? colors.ink : colors.surf,
                    borderColor: selected ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => {
                  setSkin({
                    preset: preset.id,
                    fill: preset.fill,
                    stroke: preset.stroke,
                    eyes: preset.eyes,
                    bowtie: preset.bowtie,
                    hat: preset.hat,
                    band: preset.band,
                  });
                  setLastRandomName(null);
                  setDarkStage(preset.darkStage);
                }}
              >
                <View
                  style={[
                    styles.swatchThumb,
                    { backgroundColor: selected ? 'rgba(255,255,255,0.14)' : colors.bg },
                  ]}
                >
                  <MascotVectorRig size={28} skin={preset} state="idle" animated={false} />
                </View>
                <View style={styles.presetMeta}>
                  <Text
                    style={[styles.presetName, { color: selected ? colors.bg : colors.ink }]}
                    numberOfLines={1}
                  >
                    {preset.name}
                  </Text>
                  <Text
                    style={[styles.presetTag, { color: selected ? colors.line : colors.muted }]}
                    numberOfLines={1}
                  >
                    {preset.tag}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>CORES GERAIS, CHAPÉU E GRAVATA</Text>
        <View style={styles.fieldsWrap}>
          {PICKER_FIELDS.map((f) => {
            const selected = activeField === f.key;
            const currentHex = resolved[f.key];
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
                <View style={[styles.colorDot, { backgroundColor: currentHex }]} />
                <Text style={[styles.fieldChipText, { color: selected ? colors.bg : colors.ink }]}>
                  {f.label} · {currentHex.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.swatchesRow}>
          {COLOR_SWATCHES.map((hex) => {
            const isCurrent = resolved[activeField].toLowerCase() === hex.toLowerCase();
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
                onPress={() => {
                  setLastRandomName(null);
                  setSkin((prev) => ({ ...prev, preset: 'custom', [activeField]: hex }));
                }}
              >
                {isCurrent && (
                  <MaterialIcons
                    name="check"
                    size={14}
                    color={hex === '#FFFFFF' || hex === '#F5F5F5' ? '#0A0A0A' : '#FFFFFF'}
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
            {saving
              ? 'Salvando...'
              : mode === 'create'
              ? 'Ativar bot com esta aparência'
              : 'Salvar aparência'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scroll: { maxHeight: 540 },
  stageBox: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  stageTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stageTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stagePillText: { fontSize: 11, fontWeight: '600' },
  rigWrap: { paddingVertical: 10 },
  reactBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  reactBtnText: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    width: '48.5%',
    gap: 8,
  },
  swatchThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetMeta: { flex: 1, minWidth: 0 },
  presetName: { fontSize: 12, fontWeight: '700' },
  presetTag: { fontSize: 10, marginTop: 1 },
  fieldsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
    borderColor: 'rgba(0,0,0,0.18)',
  },
  fieldChipText: { fontSize: 11, fontWeight: '600' },
  swatchesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
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
  saveBtnText: { fontSize: 14, fontWeight: '700' },
});
