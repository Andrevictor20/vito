import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTriggers } from '../hooks/useTriggers';
import { MyTriggersList } from '../components/triggers/MyTriggersList';
import { TriggerReportsView } from '../components/triggers/TriggerReportsView';
import { NaturalPromptInput } from '../components/triggers/NaturalPromptInput';
import { ExploreTemplatesSection } from '../components/triggers/ExploreTemplatesSection';
import { EditTriggerModal } from '../components/triggers/EditTriggerModal';
import { CreateTriggerModal } from '../components/triggers/CreateTriggerModal';
import { Trigger, TriggerTemplate } from '../types';
import { countTriggersByCategory } from '../utils/radarFilter';

type TriggersTab = 'my_triggers' | 'explore';

export const TriggersScreen: React.FC<{
  onSubViewChange?: (inSubView: boolean) => void;
  createRequestId?: number;
}> = ({ onSubViewChange, createRequestId }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const {
    triggers,
    allTriggers,
    loading,
    refreshing,
    onRefresh,
    selectedCategory,
    setSelectedCategory,
    handleCreateTrigger,
    handleActivateTemplate,
    handleToggleTrigger,
    handleDeleteTrigger,
    handleUpdateTrigger,
    handleRunTrigger,
  } = useTriggers(user?.id);

  const [activeTab, setActiveTab] = useState<TriggersTab>('my_triggers');
  const [reportTrigger, setReportTrigger] = useState<Trigger | null>(null);
  const [editTrigger, setEditTrigger] = useState<Trigger | null>(null);
  const [createVisible, setCreateVisible] = useState<boolean>(false);
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);
  const firstCreateRender = useRef(false);

  useEffect(() => {
    onSubViewChange?.(!!reportTrigger);
  }, [reportTrigger, onSubViewChange]);

  useEffect(() => {
    if (!firstCreateRender.current) {
      firstCreateRender.current = true;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setCreateVisible(true);
    }
  }, [createRequestId]);

  useEffect(() => {
    const onBackPress = () => {
      if (createVisible) {
        setCreateVisible(false);
        return true;
      }
      if (reportTrigger) {
        setReportTrigger(null);
        return true;
      }
      if (editTrigger) {
        setEditTrigger(null);
        return true;
      }
      if (activeTab === 'explore') {
        setActiveTab('my_triggers');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [createVisible, reportTrigger, editTrigger, activeTab]);

  const categoryCounts = useMemo(
    () => countTriggersByCategory(allTriggers),
    [allTriggers]
  );

  const activeTriggers = useMemo(
    () => triggers.filter((t) => t.status === 'active'),
    [triggers]
  );
  const pausedTriggers = useMemo(
    () => triggers.filter((t) => t.status !== 'active'),
    [triggers]
  );

  const handleActivateTemplateFromExplore = async (template: TriggerTemplate) => {
    setActivatingTemplateId(template.id);
    try {
      await handleActivateTemplate(template.id);
      setActiveTab('my_triggers');
    } catch (err) {
      console.error('[TriggersScreen] Erro ao ativar template:', err);
    } finally {
      setActivatingTemplateId(null);
    }
  };

  if (reportTrigger) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <TriggerReportsView
          trigger={reportTrigger}
          onBack={() => setReportTrigger(null)}
          onEdit={(t) => setEditTrigger(t)}
          onRunNow={handleRunTrigger}
          onToggle={async (id) => {
            await handleToggleTrigger(id);
            setReportTrigger((prev) =>
              prev && prev.id === id
                ? {
                    ...prev,
                    status: prev.status === 'active' ? 'paused' : 'active',
                  }
                : prev
            );
          }}
          onDeleteRadar={async (id) => {
            await handleDeleteTrigger(id);
            setReportTrigger(null);
          }}
        />

        <EditTriggerModal
          visible={editTrigger !== null}
          trigger={editTrigger}
          onClose={() => setEditTrigger(null)}
          onDelete={async (id) => {
            await handleDeleteTrigger(id);
            setReportTrigger(null);
          }}
          onSave={async (id, updates) => {
            const updated = await handleUpdateTrigger(id, updates);
            if (reportTrigger && reportTrigger.id === id) {
              setReportTrigger(updated);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Segmented Control .seg: Minhas vigílias [N] | Explorar por área */}
      <View style={styles.segmentContainer}>
        <View style={[styles.segmentTrack, { backgroundColor: colors.surf }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'my_triggers' && [
                styles.segmentTabActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => setActiveTab('my_triggers')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'my_triggers' }}
            accessibilityLabel="Minhas vigílias"
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeTab === 'my_triggers' ? colors.ink : colors.muted,
                  fontFamily: activeTab === 'my_triggers'
                    ? tokens.typography.family.semibold
                    : tokens.typography.family.medium,
                },
              ]}
            >
              Minhas vigílias
            </Text>
            {allTriggers.length > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: activeTab === 'my_triggers' ? colors.surf : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.muted,
                      fontFamily: tokens.typography.family.semibold,
                    },
                  ]}
                >
                  {allTriggers.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'explore' && [
                styles.segmentTabActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => setActiveTab('explore')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'explore' }}
            accessibilityLabel="Explorar por área"
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeTab === 'explore' ? colors.ink : colors.muted,
                  fontFamily: activeTab === 'explore'
                    ? tokens.typography.family.semibold
                    : tokens.typography.family.medium,
                },
              ]}
            >
              Explorar por área
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'explore' ? (
        <ExploreTemplatesSection
          onActivate={handleActivateTemplateFromExplore}
          activatingId={activatingTemplateId}
        />
      ) : (
        <>
          <NaturalPromptInput
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categoryCounts={categoryCounts}
            totalCount={allTriggers.length}
            filteredCount={triggers.length}
            onCreateFromPrompt={handleCreateTrigger}
          />

          <MyTriggersList
            activeTriggers={activeTriggers}
            pausedTriggers={pausedTriggers}
            loading={loading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            selectedCategory={selectedCategory}
            onToggle={handleToggleTrigger}
            onPress={(t) => setReportTrigger(t)}
            onExplorePress={() => setActiveTab('explore')}
          />
        </>
      )}

      {/* Modal de Edição */}
      <EditTriggerModal
        visible={editTrigger !== null}
        trigger={editTrigger}
        onClose={() => setEditTrigger(null)}
        onDelete={handleDeleteTrigger}
        onSave={async (id, updates) => {
          await handleUpdateTrigger(id, updates);
        }}
      />

      {/* Modal de Criação (+ Novo no Header) */}
      <CreateTriggerModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={async (input) => {
          await handleCreateTrigger(input);
          setCreateVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 18,
    gap: 6,
  },
  segmentTabActive: {
    shadowColor: 'rgba(20,25,22,0.14)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentTabText: {
    fontSize: 13.5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
  },
  badgeText: {
    fontSize: 11.5,
  },
});
