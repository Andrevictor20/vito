import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { MOTION_CURVES } from '../../../theme/motion';
import { useBots } from '../hooks/useBots';
import { chatPromptBus, tabNavigationBus } from '../../../services/dataSync';
import { StaggerItem, useReduceMotion } from '../../../theme/vitoMotion';
import {
  Bot,
  BotPendingApproval,
  BotSkin,
  BotTemplate,
  PendingResolutionDecision,
  SkillPackage,
} from '../types/bots';
import { getBotsHeaderSubtitle } from '../utils/botsHelpers';
import { BotsCatalogTab } from '../components/BotsCatalogTab';
import {
  NewBotChoiceSheet,
  SkillDetailSheet,
  SkillPickBotSheet,
} from '../components/BotCatalogSheets';
import { BotDetailView } from '../components/BotDetailView';
import { BotsMyTab } from '../components/BotsMyTab';
import { MascotStudioModal } from '../components/MascotStudioModal';
import { TemplateSheet } from '../components/TemplateSheet';

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
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const reduceMotion = useReduceMotion();
  const tabFade = useSharedValue(1);
  const firstTabRender = useRef(true);
  const {
    bots,
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
    loadBotDetails,
    resolvePending,
    updateActionPolicy,
    addAction,
    addSkill,
    removeSkill,
    upgradeSkill,
  } = useBots(user?.id);

  const [activeTab, setActiveTab] = useState<BotsTab>('my_bots');

  useEffect(() => {
    if (firstTabRender.current) {
      firstTabRender.current = false;
      return;
    }
    if (reduceMotion) {
      cancelAnimation(tabFade);
      tabFade.value = 1;
      return;
    }
    const [x1, y1, x2, y2] = MOTION_CURVES.q;
    cancelAnimation(tabFade);
    tabFade.value = 0;
    tabFade.value = withTiming(1, {
      duration: 260,
      easing: Easing.bezier(x1, y1, x2, y2),
    });
    return () => cancelAnimation(tabFade);
  }, [activeTab, reduceMotion, tabFade]);

  const tabContentStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: tabFade.value,
    transform: [{ translateY: interpolate(tabFade.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
  }));
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
        onRefreshBot={loadBotDetails}
        onResolvePending={handleResolvePending}
        onUpdateActionPolicy={(botId, actionKey, policy, alwaysAsk) => {
          updateActionPolicy(botId, actionKey, policy, alwaysAsk).catch((err) => {
            Alert.alert('Ação protegida', err instanceof Error ? err.message : 'Operação recusada.');
          });
        }}
        onAddAction={(botId, actionKey, policy, alwaysAsk) => {
          addAction(botId, actionKey, policy, alwaysAsk).catch((err) => {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao adicionar ação.');
          });
        }}
        onAddSkill={(botId, skillKey) => {
          addSkill(botId, skillKey).catch((err) => {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao adicionar habilidade.');
          });
        }}
        onRemoveSkill={(botId, skillKey) => {
          removeSkill(botId, skillKey).catch((err) => {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao remover habilidade.');
          });
        }}
        onUpgradeSkill={(botId, skillKey) => {
          upgradeSkill(botId, skillKey).catch((err) => {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao atualizar habilidade.');
          });
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Segmento 2 abas: Meus bots | Catálogo */}
      <StaggerItem index={0} style={styles.segmentContainer}>
        <View style={[styles.segmentTrack, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'my_bots' && { backgroundColor: colors.ink },
            ]}
            onPress={() => setActiveTab('my_bots')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'my_bots' }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'my_bots' ? colors.bg : colors.muted },
                activeTab === 'my_bots' && styles.segmentTextActive,
              ]}
            >
              Meus bots
            </Text>
            {bots.length > 0 && (
              <View
                style={[
                  styles.segBadge,
                  {
                    backgroundColor:
                      activeTab === 'my_bots'
                        ? isDark
                          ? 'rgba(0,0,0,0.18)'
                          : 'rgba(255,255,255,0.22)'
                        : colors.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segBadgeText,
                    { color: activeTab === 'my_bots' ? colors.bg : colors.muted },
                  ]}
                >
                  {bots.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'catalog' && { backgroundColor: colors.ink },
            ]}
            onPress={() => setActiveTab('catalog')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'catalog' }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'catalog' ? colors.bg : colors.muted },
                activeTab === 'catalog' && styles.segmentTextActive,
              ]}
            >
              Catálogo
            </Text>
          </TouchableOpacity>
        </View>
      </StaggerItem>

      <StaggerItem index={1} style={{ flex: 1 }}>
      <Animated.View style={tabContentStyle}>
        {activeTab === 'my_bots' ? (
          <BotsMyTab
            bots={bots}
            loading={loading}
            refreshing={refreshing}
            error={error}
            isOfflineCache={isOfflineCache}
            onRefresh={onRefresh}
            onRetry={retry}
            onOpenBot={(b: Bot) => {
              setSelectedBotId(b.id);
              void loadBotDetails(b.id);
            }}
            onToggleBot={(b: Bot) => {
              toggleBot(b).catch(() => {
                Alert.alert('Erro', 'Não foi possível alterar o status do bot.');
              });
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
      </Animated.View>
      </StaggerItem>

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
          addSkill(botId, skillKey).catch(() => {
            Alert.alert('Erro', 'Não foi possível aplicar a habilidade neste bot.');
          });
          setActiveTab('my_bots');
          setSelectedBotId(botId);
          void loadBotDetails(botId);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  segmentText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13.5,
  },
  segmentTextActive: {
    fontFamily: 'Geist_600SemiBold',
  },
  segBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  segBadgeText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 11.5,
  },
});
