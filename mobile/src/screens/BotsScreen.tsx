import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBots } from '../hooks/useBots';
import { chatPromptBus, tabNavigationBus } from '../services/dataSync';
import {
  Bot,
  BotPendingApproval,
  BotSkin,
  BotTemplate,
  PendingResolutionDecision,
  SkillPackage,
} from '../types/bots';
import { getBotsHeaderSubtitle } from '../utils/botsHelpers';
import { BotsCatalogTab } from '../components/bots/BotsCatalogTab';
import {
  NewBotChoiceSheet,
  SkillDetailSheet,
  SkillPickBotSheet,
} from '../components/bots/BotCatalogSheets';
import { BotDetailView } from '../components/bots/BotDetailView';
import { BotsMyTab } from '../components/bots/BotsMyTab';
import { MascotStudioModal } from '../components/bots/MascotStudioModal';
import { TemplateSheet } from '../components/bots/TemplateSheet';

type BotsTab = 'my_bots' | 'catalog';

export interface BotsScreenProps {
  onSubViewChange?: (inSubView: boolean) => void;
  onSubtitleChange?: (subtitle: string) => void;
  createRequestId?: number;
}

export const BotsScreen: React.FC<BotsScreenProps> = ({
  onSubViewChange,
  onSubtitleChange,
  createRequestId,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    bots,
    activity,
    templates,
    skills,
    apps,
    loading,
    refreshing,
    error,
    isOfflineCache,
    onRefresh,
    retry,
    createBot,
    updateBot,
    toggleBot,
    deleteBot,
    runBot,
    resolvePending,
    updateActionPolicy,
    addAction,
    addSkill,
    removeSkill,
    upgradeSkill,
  } = useBots(user?.id);

  const [activeTab, setActiveTab] = useState<BotsTab>('my_bots');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [showNewBotChoice, setShowNewBotChoice] = useState(false);
  const [showMascotStudio, setShowMascotStudio] = useState(false);
  const [studioDraft, setStudioDraft] = useState<{
    title: string;
    goal: string;
    category: string;
    skin?: BotSkin;
    templateKey?: string;
  }>({ title: '', goal: '', category: 'Personalizado' });

  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillPackage | null>(null);
  const [pickBotSkill, setPickBotSkill] = useState<SkillPackage | null>(null);

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) ?? null,
    [bots, selectedBotId]
  );

  useEffect(() => {
    onSubViewChange?.(!!selectedBot);
  }, [selectedBot, onSubViewChange]);

  useEffect(() => {
    onSubtitleChange?.(getBotsHeaderSubtitle(bots));
  }, [bots, onSubtitleChange]);

  const firstCreateRender = useRef(true);
  useEffect(() => {
    if (firstCreateRender.current) {
      firstCreateRender.current = false;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setShowNewBotChoice(true);
    }
  }, [createRequestId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedBot) {
        setSelectedBotId(null);
        return true;
      }
      if (activeTab === 'catalog') {
        setActiveTab('my_bots');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedBot, activeTab]);

  const handleResolvePending = useCallback(
    async (
      botId: string,
      pending: BotPendingApproval,
      decision: PendingResolutionDecision
    ) => {
      setResolvingId(pending.confirmation_id);
      try {
        await resolvePending(botId, pending.confirmation_id, decision, pending.always_ask);
      } catch (err) {
        Alert.alert(
          'Não permitido',
          err instanceof Error ? err.message : 'Não foi possível resolver esta aprovação.'
        );
      } finally {
        setResolvingId(null);
      }
    },
    [resolvePending]
  );

  const handleAskVito = useCallback((prompt?: string) => {
    if (prompt) {
      chatPromptBus.notify(prompt);
    }
    tabNavigationBus.notify('chat');
  }, []);

  if (selectedBot) {
    return (
      <BotDetailView
        bot={selectedBot}
        skills={skills}
        apps={apps}
        onBack={() => setSelectedBotId(null)}
        onToggle={async (b) => {
          await toggleBot(b);
        }}
        onUpdateBot={async (id, payload) => {
          await updateBot(id, payload);
        }}
        onDeleteBot={deleteBot}
        onRunNow={async (id) => {
          await runBot(id);
        }}
        onResolvePending={handleResolvePending}
        onUpdateActionPolicy={(botId, actionKey, policy, alwaysAsk) => {
          updateActionPolicy(botId, actionKey, policy, alwaysAsk).catch((err) => {
            Alert.alert('Ação protegida', err instanceof Error ? err.message : 'Operação recusada.');
          });
        }}
        onAddAction={(botId, actionKey, policy, alwaysAsk) => {
          addAction(botId, actionKey, policy, alwaysAsk).catch(() => {});
        }}
        onAddSkill={(botId, skillKey) => {
          addSkill(botId, skillKey).catch(() => {});
        }}
        onRemoveSkill={(botId, skillKey) => {
          removeSkill(botId, skillKey).catch(() => {});
        }}
        onUpgradeSkill={(botId, skillKey) => {
          upgradeSkill(botId, skillKey).catch(() => {});
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Segmento 2 abas: Meus bots | Catálogo */}
      <View style={styles.segmentContainer}>
        <View style={[styles.segmentTrack, { backgroundColor: colors.surf }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'my_bots' && [styles.segmentTabActive, { backgroundColor: colors.bg }],
            ]}
            onPress={() => setActiveTab('my_bots')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'my_bots' }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'my_bots' ? colors.ink : colors.muted },
              ]}
            >
              Meus bots {bots.length > 0 ? `(${bots.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'catalog' && [styles.segmentTabActive, { backgroundColor: colors.bg }],
            ]}
            onPress={() => setActiveTab('catalog')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'catalog' }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'catalog' ? colors.ink : colors.muted },
              ]}
            >
              Catálogo
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'my_bots' ? (
        <BotsMyTab
          bots={bots}
          activity={activity}
          loading={loading}
          refreshing={refreshing}
          error={error}
          isOfflineCache={isOfflineCache}
          onRefresh={onRefresh}
          onRetry={retry}
          onOpenBot={(b: Bot) => setSelectedBotId(b.id)}
          onToggleBot={(b: Bot) => {
            toggleBot(b).catch(() => {});
          }}
          onResolvePending={handleResolvePending}
          onAskVitoChip={(prompt) => handleAskVito(prompt)}
          onOpenCatalog={() => setActiveTab('catalog')}
          onOpenMascotStudio={() => {
            setStudioDraft({ title: '', goal: '', category: 'Personalizado' });
            setShowMascotStudio(true);
          }}
          resolvingId={resolvingId}
        />
      ) : (
        <BotsCatalogTab
          templates={templates}
          skills={skills}
          onSelectTemplate={(tpl) => setSelectedTemplate(tpl)}
          onSelectSkill={(sk) => setSelectedSkill(sk)}
          onOpenMascotStudio={() => {
            setStudioDraft({ title: '', goal: '', category: 'Personalizado' });
            setShowMascotStudio(true);
          }}
        />
      )}

      <NewBotChoiceSheet
        visible={showNewBotChoice}
        onClose={() => setShowNewBotChoice(false)}
        onChooseMascotStudio={() => {
          setStudioDraft({ title: '', goal: '', category: 'Personalizado' });
          setShowMascotStudio(true);
        }}
        onChooseAskVito={() =>
          handleAskVito('Quero criar um novo bot personalizado. Me ajude a definir o objetivo.')
        }
      />

      <MascotStudioModal
        visible={showMascotStudio}
        onClose={() => setShowMascotStudio(false)}
        mode="create"
        initialTitle={studioDraft.title}
        initialGoal={studioDraft.goal}
        initialCategory={studioDraft.category}
        initialSkin={studioDraft.skin}
        onSave={async (data) => {
          const created = await createBot({
            template_key: studioDraft.templateKey,
            title: data.title,
            goal: data.goal,
            category: data.category,
            skin_json: data.skin_json,
          });
          setActiveTab('my_bots');
          setSelectedBotId(created.id);
        }}
      />

      <TemplateSheet
        visible={!!selectedTemplate}
        template={selectedTemplate}
        apps={apps}
        onClose={() => setSelectedTemplate(null)}
        onActivate={async (tpl, skin) => {
          const created = await createBot({
            template_key: tpl.key,
            skin_json: JSON.stringify(skin),
          });
          setActiveTab('my_bots');
          setSelectedBotId(created.id);
        }}
        onCustomizeMascot={(tpl, skin) => {
          setStudioDraft({
            title: tpl.name,
            goal: tpl.goal,
            category: tpl.category,
            skin,
            templateKey: tpl.key,
          });
          setShowMascotStudio(true);
        }}
      />

      <SkillDetailSheet
        visible={!!selectedSkill}
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onApplyToBot={(sk) => setPickBotSkill(sk)}
      />

      <SkillPickBotSheet
        visible={!!pickBotSkill}
        skill={pickBotSkill}
        bots={bots}
        onClose={() => setPickBotSkill(null)}
        onPickBot={(botId, skillKey) => {
          addSkill(botId, skillKey).catch(() => {});
          setActiveTab('my_bots');
          setSelectedBotId(botId);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentTabActive: {
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
