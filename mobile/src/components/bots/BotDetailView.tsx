import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { navigateToAiProviders } from '../../navigation/navigationRef';
import type { ModelProviderGroup, ReasoningEffort } from '../../types/aiProviders';
import {
  ActionPolicy,
  Bot,
  BotAppInfo,
  BotChatMessage,
  BotPendingApproval,
  PendingResolutionDecision,
  SkillPackage,
  UpdateBotPayload,
} from '../../types/bots';
import { parseBotSkin } from '../../utils/botsHelpers';
import { ModelPickerSheet } from '../ai/ModelPickerSheet';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { VitoSwitch } from '../ui/VitoSwitch';
import { AddActionSheet, AddSkillSheet } from './BotCatalogSheets';
import { BotChatTab } from './BotChatTab';
import { BotDetailsTab } from './BotDetailsTab';
import { MascotStudioModal } from './MascotStudioModal';

export interface BotDetailViewProps {
  bot: Bot;
  skills: SkillPackage[];
  apps: BotAppInfo[];
  onBack: () => void;
  onToggle: (bot: Bot) => Promise<void>;
  onUpdateBot: (id: string, payload: UpdateBotPayload) => Promise<void>;
  onDeleteBot: (id: string) => Promise<void>;
  onRunNow: (id: string) => Promise<void>;
  onResolvePending: (
    botId: string,
    pending: BotPendingApproval,
    decision: PendingResolutionDecision
  ) => void;
  onUpdateActionPolicy: (
    botId: string,
    actionKey: string,
    policy: ActionPolicy,
    alwaysAsk?: boolean
  ) => void;
  onAddAction: (botId: string, actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => void;
  onAddSkill: (botId: string, skillKey: string) => void;
  onRemoveSkill: (botId: string, skillKey: string) => void;
  onUpgradeSkill: (botId: string, skillKey: string) => void;
}

export const BotDetailView: React.FC<BotDetailViewProps> = ({
  bot,
  skills,
  apps,
  onBack,
  onToggle,
  onUpdateBot,
  onDeleteBot,
  onRunNow,
  onResolvePending,
  onUpdateActionPolicy,
  onAddAction,
  onAddSkill,
  onRemoveSkill,
  onUpgradeSkill,
}) => {
  const { colors } = useTheme();
  const [subTab, setSubTab] = useState<'chat' | 'details'>('chat');
  const [runningNow, setRunningNow] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modelGroups, setModelGroups] = useState<ModelProviderGroup[]>([]);
  const [inheritedModel, setInheritedModel] = useState<string>('srv:auto');

  useEffect(() => {
    if (!showModelPicker) return;
    Promise.all([
      api.aiProviders.listSelectableModels().catch(() => []),
      api.aiProviders.getPreferences().catch(() => ({ default_model: 'srv:auto', default_effort: 'auto' })),
    ]).then(([groups, prefs]) => {
      setModelGroups(groups);
      setInheritedModel(prefs.default_model || 'srv:auto');
    });
  }, [showModelPicker]);

  const handleRunNow = async () => {
    if (runningNow) return;
    setRunningNow(true);
    try {
      await onRunNow(bot.id);
    } finally {
      setRunningNow(false);
    }
  };

  const handleAcceptProposal = async (msg: BotChatMessage) => {
    if (!msg.proposal) return;
    if (msg.proposal.kind === 'skill' && typeof msg.proposal.payload.skill_key === 'string') {
      onAddSkill(bot.id, msg.proposal.payload.skill_key);
    }
  };

  const isActive = bot.status === 'active';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Cabeçalho #s-rdd */}
      <View style={[styles.header, { borderBottomColor: colors.line }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerCol}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {bot.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
            {bot.category} · {isActive ? 'Ativo' : 'Pausado'}
          </Text>
        </View>
        <VitoSwitch
          value={isActive}
          onValueChange={() => onToggle(bot)}
        />
      </View>

      {/* Segmento Chat | Detalhes */}
      <View style={styles.segWrap}>
        <View style={[styles.segTrack, { backgroundColor: colors.surf }]}>
          <TouchableOpacity
            style={[styles.segTab, subTab === 'chat' && { backgroundColor: colors.bg }]}
            onPress={() => setSubTab('chat')}
          >
            <Text style={[styles.segText, { color: subTab === 'chat' ? colors.ink : colors.muted }]}>
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segTab, subTab === 'details' && { backgroundColor: colors.bg }]}
            onPress={() => setSubTab('details')}
          >
            <Text
              style={[styles.segText, { color: subTab === 'details' ? colors.ink : colors.muted }]}
            >
              Detalhes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {subTab === 'chat' ? (
        <BotChatTab
          bot={bot}
          onRunNow={handleRunNow}
          onResolvePending={onResolvePending}
          onAcceptProposal={handleAcceptProposal}
          runningNow={runningNow}
        />
      ) : (
        <BotDetailsTab
          bot={bot}
          runningNow={runningNow}
          onRunNow={handleRunNow}
          onOpenAppearance={() => setShowAppearance(true)}
          onOpenAddSkill={() => setShowAddSkill(true)}
          onOpenAddAction={() => setShowAddAction(true)}
          onOpenModelPicker={() => setShowModelPicker(true)}
          onUpdateActionPolicy={(actionKey, policy, alwaysAsk) =>
            onUpdateActionPolicy(bot.id, actionKey, policy, alwaysAsk)
          }
          onRemoveSkill={(skillKey) => onRemoveSkill(bot.id, skillKey)}
          onUpgradeSkill={(skillKey) => onUpgradeSkill(bot.id, skillKey)}
          onToggleQuiet={(quiet) => onUpdateBot(bot.id, { quiet })}
          onDeleteBot={() => setShowDeleteConfirm(true)}
        />
      )}

      <MascotStudioModal
        visible={showAppearance}
        onClose={() => setShowAppearance(false)}
        mode="edit"
        initialTitle={bot.title}
        initialGoal={bot.goal}
        initialCategory={bot.category}
        initialSkin={parseBotSkin(bot.skin_json, bot.skin)}
        onSave={async (data) => {
          await onUpdateBot(bot.id, {
            title: data.title,
            goal: data.goal,
            category: data.category,
            skin_json: data.skin_json,
          });
        }}
      />

      <AddSkillSheet
        visible={showAddSkill}
        skills={skills}
        existingSkillKeys={bot.skills.map((s) => s.skill_key)}
        onClose={() => setShowAddSkill(false)}
        onAddSkill={(skillKey) => onAddSkill(bot.id, skillKey)}
      />

      <AddActionSheet
        visible={showAddAction}
        apps={apps}
        existingActionKeys={bot.actions.map((a) => a.action_key)}
        onClose={() => setShowAddAction(false)}
        onAddAction={(actionKey, policy, alwaysAsk) =>
          onAddAction(bot.id, actionKey, policy, alwaysAsk)
        }
      />

      <ModelPickerSheet
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        scopeLabel="Padrão deste bot"
        allowInherit={true}
        selectedModel={bot.model_pref}
        inheritedModel={inheritedModel}
        selectedEffort={(bot.effort_pref as ReasoningEffort) || 'auto'}
        groups={modelGroups}
        onSelectModel={(modelVal) => {
          api.aiProviders
            .updateBotModel(bot.id, {
              model_pref: modelVal ?? '',
              effort_pref: (bot.effort_pref as ReasoningEffort) || 'auto',
            })
            .catch(() => {});
        }}
        onSelectEffort={(effort) => {
          api.aiProviders
            .updateBotModel(bot.id, {
              model_pref: bot.model_pref || '',
              effort_pref: effort,
            })
            .catch(() => {});
        }}
        onManageProviders={() => {
          setShowModelPicker(false);
          navigateToAiProviders();
        }}
      />

      <ConfirmDeleteModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await onDeleteBot(bot.id);
          onBack();
        }}
        title="Excluir bot?"
        message={`O bot "${bot.title}" e suas regras serão removidos permanentemente.`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCol: { flex: 1, gap: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  segWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  segTrack: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  segTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segText: { fontSize: 13, fontWeight: '700' },
});
