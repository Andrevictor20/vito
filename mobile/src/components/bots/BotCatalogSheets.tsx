import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';
import { ActionPolicy, Bot, BotAppInfo, SkillPackage } from '../../types/bots';
import { BottomSheetModal } from '../ui/BottomSheetModal';

export const NewBotChoiceSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  onChooseMascotStudio: () => void;
  onChooseAskVito: () => void;
}> = ({ visible, onClose, onChooseMascotStudio, onChooseAskVito }) => {
  const { colors } = useTheme();
  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Novo bot">
      <View style={styles.choiceList}>
        <TouchableOpacity
          style={[styles.choiceRow, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => {
            onClose();
            onChooseMascotStudio();
          }}
        >
          <ProtoUiIcon name="palette" size={22} color={colors.ink} />
          <View style={styles.col}>
            <Text style={[styles.choiceTitle, { color: colors.ink }]}>
              Configurar mascote e função
            </Text>
            <Text style={[styles.choiceSub, { color: colors.muted }]}>
              Escolha nome, cores próprias e personalize o bot
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.choiceRow, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => {
            onClose();
            onChooseAskVito();
          }}
        >
          <ProtoUiIcon name="auto-awesome" size={22} color={colors.acc} />
          <View style={styles.col}>
            <Text style={[styles.choiceTitle, { color: colors.ink }]}>Pedir ao Vito IA</Text>
            <Text style={[styles.choiceSub, { color: colors.muted }]}>
              Descreva o que você quer e o Vito monta o bot
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

export const SkillDetailSheet: React.FC<{
  visible: boolean;
  skill: SkillPackage | null;
  onClose: () => void;
  onApplyToBot: (skill: SkillPackage) => void;
}> = ({ visible, skill, onClose, onApplyToBot }) => {
  const { colors } = useTheme();
  if (!skill) return null;
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={skill.name}
      subtitle={`Pacote v${skill.version}`}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.desc, { color: colors.ink }]}>{skill.description}</Text>
        <Text style={[styles.label, { color: colors.muted }]}>QUANDO USAR</Text>
        <Text style={[styles.desc, { color: colors.muted }]}>{skill.when}</Text>
        <Text style={[styles.label, { color: colors.muted }]}>PASSOS</Text>
        {skill.steps.map((step, i) => (
          <Text key={i} style={[styles.stepText, { color: colors.ink }]}>
            {i + 1}. {step}
          </Text>
        ))}
        <Text style={[styles.label, { color: colors.muted, marginTop: 10 }]}>AÇÕES QUE USA</Text>
        <Text style={[styles.desc, { color: colors.acc }]}>{skill.actions.join(', ')}</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
          onPress={() => {
            onClose();
            onApplyToBot(skill);
          }}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg }]}>Aplicar em um bot</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

export const SkillPickBotSheet: React.FC<{
  visible: boolean;
  skill: SkillPackage | null;
  bots: Bot[];
  onClose: () => void;
  onPickBot: (botId: string, skillKey: string) => void;
}> = ({ visible, skill, bots, onClose, onPickBot }) => {
  const { colors } = useTheme();
  if (!skill) return null;
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Aplicar habilidade"
      subtitle={skill.name}
    >
      <ScrollView style={styles.scroll}>
        {bots.length === 0 ? (
          <Text style={[styles.desc, { color: colors.muted }]}>
            Crie um bot primeiro para aplicar esta habilidade.
          </Text>
        ) : (
          bots.map((bot) => (
            <TouchableOpacity
              key={bot.id}
              style={[styles.choiceRow, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={() => {
                onPickBot(bot.id, skill.key);
                onClose();
              }}
            >
              <View style={styles.col}>
                <Text style={[styles.choiceTitle, { color: colors.ink }]}>{bot.title}</Text>
                <Text style={[styles.choiceSub, { color: colors.muted }]}>{bot.category}</Text>
              </View>
              <ProtoUiIcon name="add" size={20} color={colors.ink} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

export const AddSkillSheet: React.FC<{
  visible: boolean;
  skills: SkillPackage[];
  existingSkillKeys: string[];
  onClose: () => void;
  onAddSkill: (skillKey: string) => void;
}> = ({ visible, skills, existingSkillKeys, onClose, onAddSkill }) => {
  const { colors } = useTheme();
  const available = skills.filter((s) => !existingSkillKeys.includes(s.key));
  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Adicionar habilidade">
      <ScrollView style={styles.scroll}>
        {available.length === 0 ? (
          <Text style={[styles.desc, { color: colors.muted }]}>
            Todas as habilidades disponíveis já estão neste bot.
          </Text>
        ) : (
          available.map((sk) => (
            <TouchableOpacity
              key={sk.key}
              style={[styles.choiceRow, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={() => {
                onAddSkill(sk.key);
                onClose();
              }}
            >
              <View style={styles.col}>
                <Text style={[styles.choiceTitle, { color: colors.ink }]}>{sk.name}</Text>
                <Text style={[styles.choiceSub, { color: colors.muted }]} numberOfLines={2}>
                  {sk.description}
                </Text>
              </View>
              <ProtoUiIcon name="add-circle-outline" size={20} color={colors.ink} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

export const AddActionSheet: React.FC<{
  visible: boolean;
  apps: BotAppInfo[];
  existingActionKeys: string[];
  onClose: () => void;
  onAddAction: (actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => void;
}> = ({ visible, apps, existingActionKeys, onClose, onAddAction }) => {
  const { colors } = useTheme();
  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Adicionar ação">
      <ScrollView style={styles.scroll}>
        {apps.map((app) => {
          const actions = app.actions.filter((a) => !existingActionKeys.includes(a.action_key));
          if (actions.length === 0) return null;
          return (
            <View key={app.app_key} style={styles.appGroup}>
              <Text style={[styles.label, { color: colors.muted }]}>
                {app.name.toUpperCase()} {!app.connected ? '(NÃO CONECTADO)' : ''}
              </Text>
              {actions.map((act) => (
                <TouchableOpacity
                  key={act.action_key}
                  style={[
                    styles.choiceRow,
                    { backgroundColor: colors.surf, borderColor: colors.line },
                  ]}
                  onPress={() => {
                    const defaultPolicy: ActionPolicy =
                      act.always_ask || act.is_write ? 'ask' : 'auto';
                    onAddAction(act.action_key, defaultPolicy, act.always_ask);
                    onClose();
                  }}
                >
                  <View style={styles.col}>
                    <Text style={[styles.choiceTitle, { color: colors.ink }]}>{act.label}</Text>
                    <Text style={[styles.choiceSub, { color: colors.muted }]}>
                      {act.always_ask
                        ? 'Sempre exige aprovação'
                        : act.is_write
                          ? 'Padrão: Aprovar antes'
                          : 'Padrão: Automática'}
                    </Text>
                  </View>
                  <ProtoUiIcon name="add" size={20} color={colors.ink} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  choiceList: { gap: 10 },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  col: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 14, fontWeight: '700' },
  choiceSub: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 },
  desc: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  stepText: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  primaryBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700' },
  appGroup: { marginBottom: 10 },
});
