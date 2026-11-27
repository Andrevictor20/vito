import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../context/ThemeContext';
import { MOTION_CURVES } from '../../../theme/motion';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { PressableScale, useReduceMotion } from '../../../theme/vitoMotion';
import { BotTemplate, SkillPackage } from '../types/bots';
import { MASCOT_PRESETS } from '../mascot/mascotPalettes';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface BotsCatalogTabProps {
  templates: BotTemplate[];
  skills: SkillPackage[];
  onSelectTemplate: (template: BotTemplate) => void;
  onSelectSkill: (skill: SkillPackage) => void;
  onOpenMascotStudio: () => void;
}

type CatalogSubTab = 'templates' | 'skills';

const SKILL_TONE_MAP: Record<string, string> = {
  cmp: 'orange',
  inv: 'blue',
  prep: 'purple',
  leave: 'teal',
  brief: 'acc',
  card: 'blue',
  draft: 'red',
  spend: 'fin',
};
const SKILL_TONE_CYCLE = ['blue', 'orange', 'purple', 'teal', 'acc', 'red', 'fin'];

function resolveTone(
  colorKey: string | undefined,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (colorKey) {
    case 'fin':
      return { fg: colors.fin, bg: colors.finBg };
    case 'red':
      return { fg: colors.red, bg: colors.redBg };
    case 'orange':
      return { fg: colors.orange, bg: colors.orangeBg };
    case 'teal':
      return { fg: colors.teal, bg: colors.tealBg };
    case 'purple':
      return { fg: colors.purple, bg: colors.purpleBg };
    case 'acc':
      return { fg: colors.acc, bg: colors.greenBg };
    case 'blue':
    default:
      return { fg: colors.blue, bg: colors.blueBg };
  }
}

export const BotsCatalogTab: React.FC<BotsCatalogTabProps> = ({
  templates,
  skills,
  onSelectTemplate,
  onSelectSkill,
  onOpenMascotStudio,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [subTab, setSubTab] = useState<CatalogSubTab>('templates');
  const fadeAnim = useSharedValue(1);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion) {
      cancelAnimation(fadeAnim);
      fadeAnim.value = 1;
      return;
    }
    const [x1, y1, x2, y2] = MOTION_CURVES.q;
    cancelAnimation(fadeAnim);
    fadeAnim.value = 0;
    fadeAnim.value = withTiming(1, {
      duration: 260,
      easing: Easing.bezier(x1, y1, x2, y2),
    });
    return () => cancelAnimation(fadeAnim);
  }, [subTab, reduceMotion, fadeAnim]);

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      { translateY: interpolate(fadeAnim.value, [0, 1], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  const cyberPreset = MASCOT_PRESETS[2];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          style={[
            styles.subTabChip,
            { backgroundColor: subTab === 'templates' ? colors.ink : colors.surf },
          ]}
          onPress={() => setSubTab('templates')}
        >
          <Text
            style={[
              styles.subTabText,
              { color: subTab === 'templates' ? colors.bg : colors.muted },
            ]}
          >
            Bots prontos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabChip,
            { backgroundColor: subTab === 'skills' ? colors.ink : colors.surf },
          ]}
          onPress={() => setSubTab('skills')}
        >
          <Text
            style={[
              styles.subTabText,
              { color: subTab === 'skills' ? colors.bg : colors.muted },
            ]}
          >
            Habilidades
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={contentAnimStyle}>
        {subTab === 'templates' ? (
          <>
            <PressableScale
              style={[
                styles.heroCreateCard,
                { backgroundColor: colors.surf, borderColor: colors.hairline },
              ]}
              onPress={onOpenMascotStudio}
            >
              <BotMascotAvatar size={46} skin={cyberPreset} animState="happy" animated={false} />
              <View style={styles.heroCreateCol}>
                <Text style={[styles.heroCreateTitle, { color: colors.ink }]}>
                  Criar bot e escolher mascote
                </Text>
                <Text style={[styles.heroCreateSub, { color: colors.muted }]}>
                  Personalize corpo, olhos, chapéu e gravata antes de ativar
                </Text>
              </View>
              <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
            </PressableScale>

            <View style={styles.tilesGrid}>
              {templates.map((tpl) => {
                const tone = resolveTone(tpl.color, colors);
                return (
                  <View key={tpl.key} style={styles.tileCell}>
                    <PressableScale
                      style={[styles.tile, { backgroundColor: colors.surf }]}
                      onPress={() => onSelectTemplate(tpl)}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
                        <ProtoUiIcon name={tpl.icon || 'smart-toy'} size={20} color={tone.fg} />
                      </View>
                      <Text style={[styles.tileCategory, { color: tone.fg }]} numberOfLines={1}>
                        {tpl.category}
                      </Text>
                      <Text style={[styles.tileName, { color: colors.ink }]} numberOfLines={2}>
                        {tpl.name}
                      </Text>
                      <Text style={[styles.tileGoal, { color: colors.muted }]} numberOfLines={3}>
                        {tpl.goal}
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.skillsList}>
            <Text style={[styles.skillsLead, { color: colors.muted }]}>
              Receitas reutilizáveis que qualquer bot pode aprender.
            </Text>
            {skills.map((skill, idx) => {
              const toneKey =
                SKILL_TONE_MAP[skill.key] ?? SKILL_TONE_CYCLE[idx % SKILL_TONE_CYCLE.length];
              const tone = resolveTone(toneKey, colors);
              return (
                <PressableScale
                  key={skill.key}
                  style={[styles.skillCard, { backgroundColor: colors.surf }]}
                  onPress={() => onSelectSkill(skill)}
                >
                  <View style={[styles.skillIcon, { backgroundColor: tone.bg }]}>
                    <ProtoUiIcon name={skill.icon || 'extension'} size={20} color={tone.fg} />
                  </View>
                  <View style={styles.skillInfo}>
                    <Text style={[styles.skillTitle, { color: colors.ink }]}>{skill.name}</Text>
                    <Text style={[styles.skillDesc, { color: colors.muted }]} numberOfLines={2}>
                      {skill.description}
                    </Text>
                    <Text style={[styles.skillActions, { color: tone.fg }]} numberOfLines={1}>
                      Usa: {(skill.actions ?? []).join(', ')}
                    </Text>
                  </View>
                  <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
                </PressableScale>
              );
            })}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  subTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  subTabChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13.5,
    fontWeight: '500',
  },
  heroCreateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
  },
  heroCreateCol: {
    flex: 1,
    gap: 2,
  },
  heroCreateTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
  },
  heroCreateSub: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    lineHeight: 17,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  tileCell: {
    width: '48.3%',
  },
  tile: {
    width: '100%',
    flex: 1,
    borderRadius: 22,
    borderWidth: 0,
    padding: 14,
    gap: 5,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileCategory: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11.5,
    fontWeight: '500',
  },
  tileName: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
  },
  tileGoal: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    lineHeight: 17,
  },
  skillsList: {
    gap: 10,
  },
  skillsLead: {
    fontFamily: 'Geist',
    fontSize: 13.5,
    marginBottom: 4,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 22,
    borderWidth: 0,
    gap: 12,
  },
  skillIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillInfo: {
    flex: 1,
    gap: 2,
  },
  skillTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
  },
  skillDesc: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    lineHeight: 17,
  },
  skillActions: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
