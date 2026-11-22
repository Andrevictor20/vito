import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BotTemplate, SkillPackage } from '../../types/bots';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface BotsCatalogTabProps {
  templates: BotTemplate[];
  skills: SkillPackage[];
  onSelectTemplate: (template: BotTemplate) => void;
  onSelectSkill: (skill: SkillPackage) => void;
  onOpenMascotStudio: () => void;
}

type CatalogSubTab = 'templates' | 'skills';

export const BotsCatalogTab: React.FC<BotsCatalogTabProps> = ({
  templates,
  skills,
  onSelectTemplate,
  onSelectSkill,
  onOpenMascotStudio,
}) => {
  const { colors } = useTheme();
  const [subTab, setSubTab] = useState<CatalogSubTab>('templates');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.subTabsRow, { backgroundColor: colors.surf }]}>
        <TouchableOpacity
          style={[
            styles.subTabBtn,
            subTab === 'templates' && { backgroundColor: colors.bg },
          ]}
          onPress={() => setSubTab('templates')}
        >
          <Text
            style={[
              styles.subTabText,
              { color: subTab === 'templates' ? colors.ink : colors.muted },
            ]}
          >
            Bots prontos ({templates.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabBtn,
            subTab === 'skills' && { backgroundColor: colors.bg },
          ]}
          onPress={() => setSubTab('skills')}
        >
          <Text
            style={[
              styles.subTabText,
              { color: subTab === 'skills' ? colors.ink : colors.muted },
            ]}
          >
            Habilidades ({skills.length})
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'templates' ? (
        <>
          <TouchableOpacity
            style={[
              styles.heroCreateCard,
              { backgroundColor: colors.ink, borderColor: colors.ink },
            ]}
            onPress={onOpenMascotStudio}
            activeOpacity={0.85}
          >
            <BotMascotAvatar size={56} animState="happy" animated={false} />
            <View style={styles.heroCreateCol}>
              <Text style={[styles.heroCreateTitle, { color: colors.bg }]}>
                Criar bot e escolher mascote
              </Text>
              <Text style={[styles.heroCreateSub, { color: colors.line }]}>
                Defina função, cores próprias e habilidades do zero
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={colors.bg} />
          </TouchableOpacity>

          <View style={styles.tilesGrid}>
            {templates.map((tpl) => (
              <TouchableOpacity
                key={tpl.key}
                style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
                onPress={() => onSelectTemplate(tpl)}
                activeOpacity={0.82}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.surf }]}>
                  <MaterialIcons
                    name={(tpl.icon as keyof typeof MaterialIcons.glyphMap) || 'smart-toy'}
                    size={20}
                    color={colors.ink}
                  />
                </View>
                <Text style={[styles.tileCategory, { color: colors.muted }]} numberOfLines={1}>
                  {tpl.category}
                </Text>
                <Text style={[styles.tileName, { color: colors.ink }]} numberOfLines={2}>
                  {tpl.name}
                </Text>
                <Text style={[styles.tileGoal, { color: colors.muted }]} numberOfLines={3}>
                  {tpl.goal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.skillsList}>
          {skills.map((skill) => (
            <TouchableOpacity
              key={skill.key}
              style={[styles.skillCard, { backgroundColor: colors.bg, borderColor: colors.line }]}
              onPress={() => onSelectSkill(skill)}
              activeOpacity={0.82}
            >
              <View style={[styles.skillIcon, { backgroundColor: colors.surf }]}>
                <MaterialIcons
                  name={(skill.icon as keyof typeof MaterialIcons.glyphMap) || 'extension'}
                  size={20}
                  color={colors.ink}
                />
              </View>
              <View style={styles.skillInfo}>
                <Text style={[styles.skillTitle, { color: colors.ink }]}>{skill.name}</Text>
                <Text style={[styles.skillDesc, { color: colors.muted }]} numberOfLines={2}>
                  {skill.description}
                </Text>
                <Text style={[styles.skillActions, { color: colors.acc }]} numberOfLines={1}>
                  Usa: {skill.actions.join(', ')}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
  },
  subTabsRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 14,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroCreateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
  },
  heroCreateCol: {
    flex: 1,
    gap: 2,
  },
  heroCreateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroCreateSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48.3%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
  tileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  tileGoal: {
    fontSize: 12,
    lineHeight: 16,
  },
  skillsList: {
    gap: 10,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  skillIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillInfo: {
    flex: 1,
    gap: 2,
  },
  skillTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  skillDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  skillActions: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
