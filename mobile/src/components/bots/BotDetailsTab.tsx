import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ActionPolicy, Bot } from '../../types/bots';
import {
  formatTimeAgoPt,
  getAvailablePoliciesForAction,
  getPolicyLabel,
} from '../../utils/botsHelpers';
import { VitoSwitch } from '../ui/VitoSwitch';

export interface BotDetailsTabProps {
  bot: Bot;
  runningNow: boolean;
  onRunNow: () => void;
  onOpenAppearance: () => void;
  onOpenAddSkill: () => void;
  onOpenAddAction: () => void;
  onOpenModelPicker: () => void;
  onUpdateActionPolicy: (actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => void;
  onRemoveSkill: (skillKey: string) => void;
  onUpgradeSkill: (skillKey: string) => void;
  onToggleQuiet: (quiet: boolean) => void;
  onDeleteBot: () => void;
}

export const BotDetailsTab: React.FC<BotDetailsTabProps> = ({
  bot,
  runningNow,
  onRunNow,
  onOpenAppearance,
  onOpenAddSkill,
  onOpenAddAction,
  onOpenModelPicker,
  onUpdateActionPolicy,
  onRemoveSkill,
  onUpgradeSkill,
  onToggleQuiet,
  onDeleteBot,
}) => {
  const { colors } = useTheme();
  const [openActions, setOpenActions] = useState(true);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Resumo da função + Executar agora */}
      <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>FUNÇÃO DO BOT</Text>
        <Text style={[styles.goalText, { color: colors.ink }]}>{bot.goal}</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
          onPress={onRunNow}
          disabled={runningNow}
        >
          {runningNow ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <MaterialIcons name="play-arrow" size={18} color={colors.bg} />
          )}
          <Text style={[styles.primaryBtnText, { color: colors.bg }]}>
            {runningNow ? 'Executando...' : 'Executar agora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Aparência -> #s-mascot */}
      <TouchableOpacity
        style={[styles.rowCard, { backgroundColor: colors.bg, borderColor: colors.line }]}
        onPress={onOpenAppearance}
      >
        <MaterialIcons name="palette" size={20} color={colors.ink} />
        <View style={styles.rowCol}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>Aparência</Text>
          <Text style={[styles.rowSub, { color: colors.muted }]}>
            Editar nome, função e cores do mascote
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      {/* Acordeão 1: Ações e Habilidades */}
      <View style={[styles.accordion, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <TouchableOpacity
          style={styles.accHeader}
          onPress={() => setOpenActions((p) => !p)}
        >
          <Text style={[styles.accTitle, { color: colors.ink }]}>
            Ações ({bot.actions.length}) · Habilidades ({bot.skills.length})
          </Text>
          <MaterialIcons
            name={openActions ? 'expand-less' : 'expand-more'}
            size={22}
            color={colors.muted}
          />
        </TouchableOpacity>

        {openActions && (
          <View style={styles.accBody}>
            {bot.skills.map((skill) => (
              <View
                key={skill.skill_key}
                style={[styles.skillRow, { backgroundColor: colors.surf, borderColor: colors.line }]}
              >
                <View style={styles.rowCol}>
                  <Text style={[styles.itemTitle, { color: colors.ink }]}>
                    {skill.name} (v{skill.version})
                  </Text>
                  {skill.upgrade_available && (
                    <TouchableOpacity
                      style={[styles.upgradeBtn, { backgroundColor: colors.acc }]}
                      onPress={() => onUpgradeSkill(skill.skill_key)}
                    >
                      <Text style={styles.upgradeText}>
                        Atualizar para v{skill.upgrade_available.new_version}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => onRemoveSkill(skill.skill_key)}>
                  <MaterialIcons name="close" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}

            {bot.actions.map((act) => {
              const policies = getAvailablePoliciesForAction(act.action_key, act.always_ask);
              return (
                <View
                  key={act.action_key}
                  style={[styles.actionRow, { borderTopColor: colors.line }]}
                >
                  <View style={styles.actionHead}>
                    <Text style={[styles.itemTitle, { color: colors.ink }]}>{act.label}</Text>
                    {act.app_connected === false && (
                      <Text style={[styles.warnText, { color: colors.orange }]}>
                        Precisa conectar {act.app_name || act.app_key}
                      </Text>
                    )}
                  </View>
                  <View style={styles.policyRow}>
                    {policies.map((pol) => {
                      const selected = act.policy === pol;
                      return (
                        <TouchableOpacity
                          key={pol}
                          style={[
                            styles.policyChip,
                            {
                              backgroundColor: selected ? colors.ink : colors.surf,
                              borderColor: selected ? colors.ink : colors.line,
                            },
                          ]}
                          onPress={() => onUpdateActionPolicy(act.action_key, pol, act.always_ask)}
                        >
                          <Text
                            style={[
                              styles.policyText,
                              { color: selected ? colors.bg : colors.muted },
                            ]}
                          >
                            {getPolicyLabel(pol)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={styles.addBtnsRow}>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.line }]}
                onPress={onOpenAddSkill}
              >
                <MaterialIcons name="add" size={16} color={colors.ink} />
                <Text style={[styles.addBtnText, { color: colors.ink }]}>Habilidade</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.line }]}
                onPress={onOpenAddAction}
              >
                <MaterialIcons name="add" size={16} color={colors.ink} />
                <Text style={[styles.addBtnText, { color: colors.ink }]}>Ação</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Acordeão 2: Quando executar + Alterar modelo */}
      <View style={[styles.accordion, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <TouchableOpacity
          style={styles.accHeader}
          onPress={() => setOpenSchedule((p) => !p)}
        >
          <Text style={[styles.accTitle, { color: colors.ink }]}>Quando executar</Text>
          <MaterialIcons
            name={openSchedule ? 'expand-less' : 'expand-more'}
            size={22}
            color={colors.muted}
          />
        </TouchableOpacity>
        {openSchedule && (
          <View style={styles.accBody}>
            <Text style={[styles.rowSub, { color: colors.ink }]}>
              {bot.trigger_label || 'Sob demanda'}
            </Text>
            <View style={styles.switchLine}>
              <Text style={[styles.itemTitle, { color: colors.ink }]}>Só avisar se mudar</Text>
              <VitoSwitch
                value={!!bot.quiet}
                onValueChange={onToggleQuiet}
              />
            </View>
            <TouchableOpacity
              style={[styles.modelBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={onOpenModelPicker}
            >
              <MaterialIcons name="psychology" size={18} color={colors.ink} />
              <View style={styles.rowCol}>
                <Text style={[styles.itemTitle, { color: colors.ink }]}>Alterar modelo</Text>
                <Text style={[styles.rowSub, { color: colors.muted }]}>
                  {bot.model_pref || 'Segue o padrão do Vito'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Acordeão 3: Histórico e regras */}
      <View style={[styles.accordion, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <TouchableOpacity
          style={styles.accHeader}
          onPress={() => setOpenHistory((p) => !p)}
        >
          <Text style={[styles.accTitle, { color: colors.ink }]}>Histórico e regras</Text>
          <MaterialIcons
            name={openHistory ? 'expand-less' : 'expand-more'}
            size={22}
            color={colors.muted}
          />
        </TouchableOpacity>
        {openHistory && (
          <View style={styles.accBody}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>EXECUÇÕES RECENTES</Text>
            {(bot.runs ?? []).length === 0 ? (
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                Nenhuma execução registrada ainda.
              </Text>
            ) : (
              (bot.runs ?? []).slice(0, 5).map((run) => (
                <View
                  key={run.id}
                  style={[styles.runBox, { backgroundColor: colors.surf, borderColor: colors.line }]}
                >
                  <Text style={[styles.itemTitle, { color: colors.ink }]}>
                    {formatTimeAgoPt(run.ran_at)} · {run.status}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>{run.summary}</Text>
                  {run.verified.length > 0 && (
                    <Text style={[styles.runList, { color: colors.acc }]}>
                      Verificado: {run.verified.join('; ')}
                    </Text>
                  )}
                  {run.actions_done.length > 0 && (
                    <Text style={[styles.runList, { color: colors.blue }]}>
                      Ações feitas: {run.actions_done.join('; ')}
                    </Text>
                  )}
                  {run.pending.length > 0 && (
                    <Text style={[styles.runList, { color: colors.orange }]}>
                      Aguardando: {run.pending.join('; ')}
                    </Text>
                  )}
                  {run.cant.length > 0 && (
                    <Text style={[styles.runList, { color: colors.red }]}>
                      Não consegui verificar: {run.cant.join('; ')}
                    </Text>
                  )}
                </View>
              ))
            )}

            {(bot.memories ?? []).length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 8 }]}>
                  MEMÓRIA DO BOT
                </Text>
                {(bot.memories ?? []).map((m) => (
                  <Text key={m.id} style={[styles.rowSub, { color: colors.ink }]}>
                    • {m.content}
                  </Text>
                ))}
              </>
            )}

            {(bot.rules ?? []).length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 8 }]}>
                  REGRAS
                </Text>
                {(bot.rules ?? []).map((r, i) => (
                  <Text key={i} style={[styles.rowSub, { color: colors.ink }]}>
                    • {r}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}
      </View>

      {/* Excluir bot */}
      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: colors.red, backgroundColor: colors.redBg }]}
        onPress={onDeleteBot}
      >
        <MaterialIcons name="delete-outline" size={18} color={colors.red} />
        <Text style={[styles.deleteBtnText, { color: colors.red }]}>Excluir bot</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 110, gap: 12 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  goalText: { fontSize: 14, lineHeight: 20 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999 },
  primaryBtnText: { fontSize: 14, fontWeight: '700' },
  rowCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  rowCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, lineHeight: 17 },
  accordion: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  accHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  accTitle: { fontSize: 15, fontWeight: '700' },
  accBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  skillRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  upgradeBtn: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  upgradeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  actionRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  actionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 13, fontWeight: '700' },
  warnText: { fontSize: 11, fontWeight: '600' },
  policyRow: { flexDirection: 'row', gap: 6 },
  policyChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  policyText: { fontSize: 11, fontWeight: '700' },
  addBtnsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  switchLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  runBox: { padding: 10, borderRadius: 12, borderWidth: 1, gap: 3 },
  runList: { fontSize: 11, lineHeight: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1, marginTop: 6 },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },
});
