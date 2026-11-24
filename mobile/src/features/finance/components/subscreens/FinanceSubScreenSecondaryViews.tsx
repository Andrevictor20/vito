import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { tokens, tabularNumbers } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { AnimatedProgressBar, CountUpText, StaggerItem } from '../../../../theme/vitoMotion';
import { getBankBrand } from '../../utils/bankBrands';
import type {
  FinanceAccount,
  FinanceConnection,
  FinancialSummary,
} from '../../types/finance';
import {
  formatBRL,
  formatRelativeSync,
  getSubscriptionName,
  hasSubscriptionIncrease,
  maskBRL,
} from '../shared/financeHelpers';
import {
  CategorySemanticBadge,
  FinanceBankBadge,
  getFinanceChartPalette,
  GoalSemanticBadge,
  resolveCategoryVisual,
  TransactionSemanticBadge,
} from '../shared/FinanceSemanticIcons';
import { subScreenStyles as styles } from './financeSubScreenStyles';

interface SubscriptionsSubViewProps {
  summary: FinancialSummary;
  isPrivacyHidden: boolean;
  onAskVito: (prompt: string) => void;
}

export const SubscriptionsSubView: React.FC<SubscriptionsSubViewProps> = ({
  summary,
  isPrivacyHidden,
  onAskVito,
}) => {
  const { colors, isDark } = useTheme();
  const subs = summary.subscriptions;
  const total = subs.reduce((acc, s) => acc + (s.amount || 0), 0);
  const priceIncreases = subs.filter(hasSubscriptionIncrease).length;

  return (
    <View>
      <StaggerItem index={0} style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>TOTAL POR MÊS</Text>
        <CountUpText
          value={total}
          decimals={2}
          prefix="R$ "
          privacyHidden={isPrivacyHidden}
          style={[styles.bigValue, tabularNumbers, { color: colors.ink }]}
        />
        <Text style={[styles.rowMeta, { color: colors.muted, marginTop: 8 }]}>
          {subs.length} {subs.length === 1 ? 'serviço' : 'serviços'}
          {priceIncreases > 0 ? ` · ${priceIncreases} reajuste neste mês` : ''}
        </Text>
      </StaggerItem>

      <StaggerItem index={1}>
        <View style={styles.secHeader}>
          <Text style={[styles.secTitle, { color: colors.ink }]}>Serviços</Text>
        </View>

      {subs.length === 0 ? (
        <View style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhuma assinatura recorrente detectada até o momento.
          </Text>
        </View>
      ) : (
        <View style={[styles.card2Flush, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
          {subs.map((sub, idx) => {
            const name = getSubscriptionName(sub);
            const increased = hasSubscriptionIncrease(sub);
            const diff =
              increased && sub.previous_amount
                ? Math.max(0, sub.amount - sub.previous_amount)
                : 0;
            return (
              <TouchableOpacity
                key={sub.id || `${name}_${idx}`}
                style={[
                  styles.txRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                ]}
                onPress={() =>
                  onAskVito(
                    `Sobre a assinatura ${name} (${formatBRL(sub.amount)}/mês): quero lembrar de cancelar ou revisar antes da próxima cobrança.`
                  )
                }
                activeOpacity={0.75}
              >
                <TransactionSemanticBadge
                  merchant={name}
                  category="Assinaturas"
                  isDark={isDark}
                  index={idx}
                  size={38}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <View style={localStyles.metaInline}>
                    <Text style={[styles.rowMeta, { color: colors.muted }]}>
                      {sub.frequency === 'yearly' ? 'Anual' : 'Todo mês'}
                    </Text>
                    {increased && (
                      <View style={[localStyles.deltaBadge, { backgroundColor: colors.redBg }]}>
                        <Text style={[localStyles.deltaBadgeText, { color: colors.orange }]}>
                          {diff > 0 ? `+${formatBRL(diff)}` : 'Reajuste'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.rowAmount, tabularNumbers, { color: colors.ink }]}>
                  {maskBRL(isPrivacyHidden, formatBRL(sub.amount))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      </StaggerItem>
    </View>
  );
};

interface GoalsSubViewProps {
  summary: FinancialSummary;
  isPrivacyHidden: boolean;
  onAskVito: (prompt: string) => void;
}

export const GoalsSubView: React.FC<GoalsSubViewProps> = ({
  summary,
  isPrivacyHidden,
  onAskVito,
}) => {
  const { colors, isDark } = useTheme();
  const pal = getFinanceChartPalette(isDark);
  const goalColors = [pal[5], pal[2], pal[0], pal[4], pal[1]];
  const budgets = summary.budgets || [];
  const goals = summary.goals || [];

  return (
    <View>
      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Orçamentos do mês</Text>
        <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
          <Text style={[styles.countText, { color: colors.muted }]}>alerta em 80%</Text>
        </View>
      </View>

      {budgets.length === 0 ? (
        <View style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Você ainda não configurou tetos de gasto por categoria. Peça ao Vito para criar um orçamento.
          </Text>
          <TouchableOpacity
            style={[styles.primaryPillBtn, { backgroundColor: colors.ink }]}
            onPress={() => onAskVito('Quero criar um orçamento mensal para minhas principais categorias de gasto.')}
            activeOpacity={0.82}
          >
            <Text style={[styles.primaryPillBtnText, { color: colors.bg }]}>
              Criar orçamento com o Vito
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        budgets.map((b, idx) => {
          const pct = b.target_amount > 0 ? Math.round((b.used_amount / b.target_amount) * 100) : 0;
          const isHot = pct >= (b.auto_alert_threshold ?? 80);
          const catVis = resolveCategoryVisual(b.title, isDark, idx);
          const barCol = pct >= 100 ? colors.red : isHot ? colors.orange : catVis.color;
          return (
            <StaggerItem key={b.id || `bd_${idx}`} index={idx}>
            <TouchableOpacity
              style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}
              onPress={() =>
                onAskVito(`Quero ajustar o limite do orçamento "${b.title}" (${formatBRL(b.target_amount, 0)}).`)
              }
              activeOpacity={0.8}
            >
              <View style={localStyles.iconTitleRow}>
                <CategorySemanticBadge category={b.title} isDark={isDark} index={idx} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={[styles.splitMeta, { marginTop: 0 }]}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text style={[styles.rowMeta, tabularNumbers, { color: colors.muted }]}>
                      {maskBRL(isPrivacyHidden, formatBRL(b.used_amount, 0))} de{' '}
                      {maskBRL(isPrivacyHidden, formatBRL(b.target_amount, 0))}
                    </Text>
                  </View>
                </View>
              </View>
              <AnimatedProgressBar
                pct={isPrivacyHidden ? 0 : Math.min(100, pct)}
                color={barCol}
                trackColor={colors.line}
                height={8}
                delayMs={220 + idx * 80}
                style={{ marginTop: 12, overflow: 'visible' }}
              >
                <View style={[localStyles.thresholdMarker, { backgroundColor: colors.ink }]} />
              </AnimatedProgressBar>
              <Text style={[styles.rowMeta, { color: isHot ? barCol : colors.muted, marginTop: 8 }]}>
                {pct}% usado{isHot ? ' · perto do limite' : ''}
              </Text>
            </TouchableOpacity>
            </StaggerItem>
          );
        })
      )}

      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Metas de economia</Text>
        <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
          <Text style={[styles.countText, { color: colors.muted }]}>{goals.length}</Text>
        </View>
      </View>

      {goals.length === 0 ? (
        <View style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhuma meta de economia ativa ainda.
          </Text>
          <TouchableOpacity
            style={[localStyles.outlinePillBtn, { borderColor: colors.ink }]}
            onPress={() => onAskVito('Quero juntar R$ 3.000. Simula quanto guardar por mês?')}
            activeOpacity={0.82}
          >
            <Text style={[localStyles.outlinePillBtnText, { color: colors.ink }]}>
              Simular meta no Vito
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        goals.map((g, idx) => {
          const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
          const goalColor = goalColors[idx % goalColors.length];
          return (
            <StaggerItem
              key={g.id || `goal_${idx}`}
              index={budgets.length + idx}
              style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}
            >
              <View style={localStyles.iconTitleRow}>
                <GoalSemanticBadge title={g.title} isDark={isDark} index={idx} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={[styles.splitMeta, { marginTop: 0 }]}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                      {g.title}
                    </Text>
                    {g.deadline_date ? (
                      <Text style={[styles.rowMeta, { color: colors.muted }]}>até {g.deadline_date}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={localStyles.goalValRow}>
                <CountUpText
                  value={g.current_amount}
                  decimals={0}
                  prefix="R$ "
                  delayMs={200 + idx * 70}
                  privacyHidden={isPrivacyHidden}
                  style={[localStyles.goalAmount, tabularNumbers, { color: colors.ink }]}
                />
                <Text style={[localStyles.goalTarget, { color: colors.muted }]}>
                  {' de '}
                  {maskBRL(isPrivacyHidden, formatBRL(g.target_amount, 0))}
                </Text>
              </View>
              <AnimatedProgressBar
                pct={isPrivacyHidden ? 0 : pct}
                color={goalColor}
                trackColor={colors.line}
                height={8}
                delayMs={260 + idx * 80}
                style={{ marginTop: 12 }}
              />
              <Text style={[styles.rowMeta, { color: goalColor, marginTop: 8, fontWeight: '500' }]}>
                {pct}% da meta
              </Text>
            </StaggerItem>
          );
        })
      )}
    </View>
  );
};

interface ConnectionsSubViewProps {
  connections: FinanceConnection[];
  accounts: FinanceAccount[];
  isPrivacyHidden: boolean;
  onOpenPluggyModal: () => void;
}

export const ConnectionsSubView: React.FC<ConnectionsSubViewProps> = ({
  connections,
  accounts,
  isPrivacyHidden,
  onOpenPluggyModal,
}) => {
  const { colors } = useTheme();

  return (
    <View>
      <View style={[localStyles.noticeCard, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <View style={[styles.chip, { backgroundColor: colors.greenBg }]}>
          <ProtoUiIcon name="verified-user" size={20} color={colors.acc} />
        </View>
        <Text style={[localStyles.noticeText, { color: colors.muted }]}>
          Seus dados ficam em modo leitura no seu servidor privado. O Vito nunca movimenta dinheiro e você pode revogar quando quiser.
        </Text>
      </View>

      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Instituições</Text>
        <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
          <Text style={[styles.countText, { color: colors.muted }]}>
            {connections.length} conectadas
          </Text>
        </View>
      </View>

      {connections.length === 0 ? (
        <View style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhuma instituição conectada ainda via Open Finance.
          </Text>
        </View>
      ) : (
        connections.map((conn, idx) => {
          const isOk = conn.status === 'UPDATED';
          const brand = getBankBrand(conn.institution_name);
          const connAccounts = accounts.filter(
            (a) => a.connection_id === conn.id || a.institution_name === conn.institution_name
          );

          return (
            <View
              key={conn.id || `conn_${idx}`}
              style={[styles.card2, { backgroundColor: colors.surf, borderColor: colors.hairline }]}
            >
              <View style={localStyles.connTop}>
                <FinanceBankBadge institutionName={conn.institution_name} size={40} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>
                    {conn.institution_name || brand.name}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]}>
                    Sincronizado {formatRelativeSync(conn.last_sync_at)}
                  </Text>
                </View>
                <View
                  style={[
                    localStyles.statusPill,
                    { backgroundColor: isOk ? colors.greenBg : colors.redBg },
                  ]}
                >
                  <View
                    style={[
                      localStyles.statusDot,
                      { backgroundColor: isOk ? colors.acc : colors.red },
                    ]}
                  />
                  <Text style={[localStyles.statusText, { color: isOk ? colors.acc : colors.red }]}>
                    {isOk ? 'Atualizado' : 'Reconectar'}
                  </Text>
                </View>
              </View>

              {connAccounts.length > 0 && (
                <View style={localStyles.connAccountsList}>
                  {connAccounts.map((acc, aIdx) => (
                    <View
                      key={acc.id || `ca_${aIdx}`}
                      style={[localStyles.connAccRow, { borderTopColor: colors.line }]}
                    >
                      <Text style={[styles.rowMeta, { color: colors.muted, flex: 1 }]} numberOfLines={1}>
                        {acc.name}
                      </Text>
                      <Text style={[styles.rowMeta, tabularNumbers, { color: colors.ink, fontWeight: '600' }]}>
                        {maskBRL(isPrivacyHidden, formatBRL(acc.balance))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={[styles.primaryPillBtn, { backgroundColor: colors.ink, marginTop: 18 }]}
        onPress={onOpenPluggyModal}
        activeOpacity={0.82}
      >
        <Text style={[styles.primaryPillBtnText, { color: colors.bg }]}>
          {connections.length > 0 ? 'Conectar ou gerenciar instituições' : 'Conectar primeira instituição'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const localStyles = StyleSheet.create({
  iconTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  deltaBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  deltaBadgeText: { fontSize: 11, fontWeight: '600' },
  thresholdMarker: { position: 'absolute', left: '80%', top: -3, bottom: -3, width: 2, borderRadius: 1 },
  goalValRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 10 },
  goalAmount: { fontFamily: tokens.typography.family.montserratBold, fontSize: 26, fontWeight: '800' },
  goalTarget: { fontSize: 14, fontWeight: '600' },
  outlinePillBtn: { height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  outlinePillBtnText: { fontSize: 14, fontWeight: '600' },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10 },
  noticeText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  connTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  connAccountsList: { marginTop: 10 },
  connAccRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTopWidth: 1 },
});
