import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { VitoMascot } from '../../../components/common/VitoMascot';
import type {
  BillingCycle,
  PrivacyPermissionsState,
  PrivacySettingsState,
  UserSubscriptionState,
} from '../services/storeComplianceApi';
import {
  DEVICE_PERMISSION_ROWS,
  formatBrl,
  STORE_PLANS,
} from './StoreCatalogData';

interface StoreProViewProps {
  subscription: UserSubscriptionState;
  selectedPlan: 'pro' | 'ultra';
  billing: BillingCycle;
  busy: boolean;
  onSelectPlan: (plan: 'pro' | 'ultra') => void;
  onChangeBilling: (b: BillingCycle) => void;
  onStartTrial: () => void;
  onRestore: () => void;
  onOpenDoc: (doc: 'terms' | 'priv') => void;
}

export const StoreProView: React.FC<StoreProViewProps> = ({
  subscription,
  selectedPlan,
  billing,
  busy,
  onSelectPlan,
  onChangeBilling,
  onStartTrial,
  onRestore,
  onOpenDoc,
}) => {
  const { colors } = useTheme();
  const isYearly = billing === 'year';
  const activePlan = STORE_PLANS.find((p) => p.id === selectedPlan) || STORE_PLANS[0];
  const priceFor = (p: (typeof STORE_PLANS)[number]) => (isYearly ? p.yearlyPrice : p.monthlyPrice);

  if (subscription.plan !== 'free') {
    const currentDef = STORE_PLANS.find((p) => p.id === subscription.plan) || STORE_PLANS[0];
    return (
      <View style={styles.section}>
        <View style={[styles.noteCard, { backgroundColor: colors.greenBg }]}>
          <Text style={[styles.noteBold, { color: colors.ink }]}>Vito {currentDef.name} ativo</Text>
          <Text style={[styles.noteText, { color: colors.ink }]}>
            {isYearly ? 'Anual' : 'Mensal'} · teste grátis ativo. Cobrança: {formatBrl(priceFor(currentDef))}.
          </Text>
        </View>
        <Text style={[styles.lbl, { color: colors.muted }]}>Gerenciar</Text>
        <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <TouchableOpacity style={styles.row} onPress={onRestore}>
            <ProtoUiIcon name="check-circle-outline" size={20} color={colors.acc} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Restaurar compras</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                Recupere compras de outro aparelho
              </Text>
            </View>
            <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <VitoMascot size={46} state="idle" />
        </View>
        <Text style={[styles.heroTitle, { color: colors.ink }]}>Vito Pro e Ultra</Text>
        <Text style={[styles.heroSub, { color: colors.muted }]}>
          Teste grátis por 7 dias. Cancele quando quiser.
        </Text>
      </View>

      <View style={[styles.seg, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {[
          { id: 'month' as BillingCycle, label: 'Mensal' },
          { id: 'year' as BillingCycle, label: 'Anual · economize até 30%' },
        ].map((b) => {
          const on = billing === b.id;
          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.segBtn, on && { backgroundColor: colors.ink }]}
              onPress={() => onChangeBilling(b.id)}
            >
              <Text
                style={[
                  styles.segText,
                  { color: on ? colors.bg : colors.muted },
                  on && styles.segTextActive,
                ]}
                numberOfLines={1}
              >
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {STORE_PLANS.map((plan) => {
        const selected = selectedPlan === plan.id;
        const price = priceFor(plan);
        return (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              {
                backgroundColor: selected ? colors.surf : colors.bg,
                borderColor: selected ? colors.ink : colors.line,
              },
            ]}
            onPress={() => onSelectPlan(plan.id)}
            activeOpacity={0.85}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.ink : colors.line }]}>
              {selected && <View style={[styles.radioDot, { backgroundColor: colors.ink }]} />}
            </View>
            <View style={styles.planBody}>
              <View style={styles.planTitleRow}>
                <Text style={[styles.planName, { color: colors.ink }]}>{plan.name}</Text>
                <View style={[styles.planBadge, { backgroundColor: colors.acc }]}>
                  <Text style={styles.planBadgeText}>{plan.badge}</Text>
                </View>
              </View>
              <Text style={[styles.planPrice, { color: colors.ink }]}>
                {formatBrl(price)}
                <Text style={[styles.planUnit, { color: colors.muted }]}>
                  {isYearly ? ' /ano' : ' /mês'}
                </Text>
              </Text>
              {isYearly && (
                <Text style={[styles.planSubPrice, { color: colors.muted }]}>
                  {formatBrl(plan.yearlyPrice / 12)}/mês
                </Text>
              )}
              <View style={styles.featList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featRow}>
                    <ProtoUiIcon name="check" size={15} color={colors.acc} />
                    <Text style={[styles.featText, { color: colors.ink }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.fineLeft, { color: colors.muted }]}>
        Plano gratuito: agenda, tarefas e chat com limites diários.
      </Text>

      <TouchableOpacity
        style={[styles.buyBtn, { backgroundColor: colors.ink, opacity: busy ? 0.6 : 1 }]}
        onPress={onStartTrial}
        disabled={busy}
      >
        <Text style={[styles.buyBtnText, { color: colors.bg }]}>
          {busy ? 'Processando…' : `Testar ${activePlan.name} por 7 dias grátis`}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.fineCenter, { color: colors.muted }]}>
        7 dias grátis, depois {formatBrl(priceFor(activePlan))}
        {isYearly ? '/ano' : '/mês'}. Cancele quando quiser.
      </Text>
      <Text style={[styles.fineCenter, { color: colors.muted }]}>
        A assinatura renova automaticamente, salvo cancelamento com 24h de antecedência no Google Play.
      </Text>

      <View style={styles.legalLinks}>
        <TouchableOpacity onPress={onRestore}>
          <Text style={[styles.linkText, { color: colors.ink }]}>Restaurar compras</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.muted }}>·</Text>
        <TouchableOpacity onPress={() => onOpenDoc('terms')}>
          <Text style={[styles.linkText, { color: colors.ink }]}>Termos de Uso</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.muted }}>·</Text>
        <TouchableOpacity onPress={() => onOpenDoc('priv')}>
          <Text style={[styles.linkText, { color: colors.ink }]}>Privacidade</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface StorePrivViewProps {
  privacy: PrivacySettingsState;
  onTogglePermission: (k: keyof PrivacyPermissionsState) => void;
  onToggleAi: () => void;
  onToggleDiag: () => void;
  onExport: () => void;
  onDeleteAccount: () => void;
}

export const StorePrivView: React.FC<StorePrivViewProps> = ({
  privacy,
  onTogglePermission,
  onToggleAi,
  onToggleDiag,
  onExport,
  onDeleteAccount,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={[styles.noteCard, { backgroundColor: colors.blueBg }]}>
        <Text style={[styles.noteText, { color: colors.ink }]}>
          Seus dados são criptografados e nunca vendidos. O Vito é uma IA e pode errar: confira informações importantes. Não substitui aconselhamento financeiro, jurídico ou médico.
        </Text>
      </View>

      <Text style={[styles.lbl, { color: colors.muted }]}>Permissões do aparelho</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {DEVICE_PERMISSION_ROWS.map((p, idx) => (
          <View
            key={p.key}
            style={[
              styles.row,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{p.label}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{p.desc}</Text>
            </View>
            <Switch
              value={!!privacy.permissions[p.key]}
              onValueChange={() => onTogglePermission(p.key)}
              trackColor={{ false: colors.line, true: colors.acc }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </View>

      <Text style={[styles.lbl, { color: colors.muted }]}>Compartilhamento</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Processar com provedores de IA</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              Seu texto e voz são enviados a OpenAI, Google ou Anthropic para gerar respostas
            </Text>
          </View>
          <Switch
            value={privacy.ai_processing_enabled}
            onValueChange={onToggleAi}
            trackColor={{ false: colors.line, true: colors.acc }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Análises e diagnósticos</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              Dados anônimos para corrigir erros
            </Text>
          </View>
          <Switch
            value={privacy.analytics_enabled}
            onValueChange={onToggleDiag}
            trackColor={{ false: colors.line, true: colors.acc }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <Text style={[styles.lbl, { color: colors.muted }]}>Seus direitos (LGPD)</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <TouchableOpacity style={styles.row} onPress={onExport}>
          <ProtoUiIcon name="download" size={20} color={colors.ink} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Baixar meus dados</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              Receba uma cópia em JSON por e-mail
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.delBtn, { borderColor: colors.red }]} onPress={onDeleteAccount}>
        <Text style={[styles.delBtnText, { color: colors.red }]}>Excluir minha conta</Text>
      </TouchableOpacity>
      <Text style={[styles.fineCenter, { color: colors.muted }]}>
        A exclusão remove conversas, agenda, tarefas e integrações em até 30 dias.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 10 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '600', marginTop: 12, letterSpacing: -0.5 },
  heroSub: { fontSize: 13.5, marginTop: 4, textAlign: 'center' },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segBtn: { flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segText: { fontFamily: 'Geist_500Medium', fontSize: 12.5 },
  segTextActive: { fontFamily: 'Geist_600SemiBold' },
  planCard: { borderRadius: 20, borderWidth: 1.5, padding: 16, flexDirection: 'row', gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planBody: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 17, fontWeight: '600' },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  planBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  planPrice: { fontSize: 22, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  planUnit: { fontSize: 13, fontWeight: '500' },
  planSubPrice: { fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
  featList: { marginTop: 10, gap: 4 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featText: { fontSize: 13 },
  buyBtn: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buyBtnText: { fontSize: 15, fontWeight: '600' },
  fineLeft: { fontSize: 12, lineHeight: 17 },
  fineCenter: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 },
  linkText: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  noteCard: { borderRadius: 16, padding: 14, gap: 4 },
  noteBold: { fontSize: 14, fontWeight: '600' },
  noteText: { fontSize: 13, lineHeight: 19 },
  lbl: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  lst: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  delBtn: { height: 46, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  delBtnText: { fontSize: 14, fontWeight: '600' },
});
