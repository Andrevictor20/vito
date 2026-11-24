import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { VitoSheet } from '../ui/VitoSheet';
import type {
  FinanceAccount,
  FinanceLimitRule,
  LimitPeriodType,
  SpendingLimitScope,
} from '../../types/finance';

interface SpendingLimitFormSheetProps {
  visible: boolean;
  initialRule?: Partial<FinanceLimitRule>;
  accounts?: FinanceAccount[];
  onClose: () => void;
  onSave: (rule: FinanceLimitRule) => Promise<void> | void;
}

const SCOPE_OPTIONS: ReadonlyArray<{ key: SpendingLimitScope; label: string }> = [
  { key: 'CATEGORY', label: 'Categoria' },
  { key: 'CARD', label: 'Cartão' },
  { key: 'SUBSCRIPTIONS', label: 'Assinaturas' },
  { key: 'MERCHANT', label: 'Loja / App' },
  { key: 'GLOBAL_MONTHLY', label: 'Total Mês' },
];

const PERIOD_OPTIONS: ReadonlyArray<{ key: LimitPeriodType; label: string }> = [
  { key: 'MONTHLY', label: 'Mensal' },
  { key: 'BILLING_CYCLE', label: 'Ciclo fatura' },
  { key: 'WEEKLY', label: 'Semanal' },
];

const THRESHOLD_PRESETS = [50, 80, 90, 100] as const;

export const SpendingLimitFormSheet: React.FC<SpendingLimitFormSheetProps> = ({
  visible,
  initialRule,
  accounts = [],
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const [scopeType, setScopeType] = useState<SpendingLimitScope>(initialRule?.scope_type ?? 'CATEGORY');
  const [title, setTitle] = useState(initialRule?.title ?? '');
  const [amountText, setAmountText] = useState(
    initialRule?.target_amount ? String(initialRule.target_amount) : '',
  );
  const [categoryFilter, setCategoryFilter] = useState(initialRule?.category_filter ?? '');
  const [accountId, setAccountId] = useState(initialRule?.account_id ?? '');
  const [merchantPattern, setMerchantPattern] = useState(initialRule?.merchant_pattern ?? '');
  const [periodType, setPeriodType] = useState<LimitPeriodType>(initialRule?.period_type ?? 'MONTHLY');
  const [thresholds, setThresholds] = useState<number[]>(initialRule?.alert_thresholds ?? [80, 100]);
  const [paceAlert, setPaceAlert] = useState(initialRule?.pace_alert_enabled ?? true);
  const [pushEnabled, setPushEnabled] = useState(
    initialRule?.notify_channels ? initialRule.notify_channels.includes('push') : true,
  );
  const [waEnabled, setWaEnabled] = useState(
    initialRule?.notify_channels ? initialRule.notify_channels.includes('whatsapp') : false,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setScopeType(initialRule?.scope_type ?? 'CATEGORY');
    setTitle(initialRule?.title ?? '');
    setAmountText(initialRule?.target_amount ? String(initialRule.target_amount) : '');
    setCategoryFilter(initialRule?.category_filter ?? '');
    setAccountId(initialRule?.account_id ?? '');
    setMerchantPattern(initialRule?.merchant_pattern ?? '');
    setPeriodType(initialRule?.period_type ?? 'MONTHLY');
    setThresholds(initialRule?.alert_thresholds ?? [80, 100]);
    setPaceAlert(initialRule?.pace_alert_enabled ?? true);
  }, [visible, initialRule]);

  const creditCards = accounts.filter((a) => a.account_type === 'CREDIT');

  const toggleThreshold = (pct: number) => {
    setThresholds((prev) =>
      prev.includes(pct) ? prev.filter((x) => x !== pct) : [...prev, pct].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    const parsedAmount = Number(amountText.replace(',', '.'));
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    const channels = ['in_app'];
    if (pushEnabled) channels.push('push');
    if (waEnabled) channels.push('whatsapp');

    setSaving(true);
    try {
      await onSave({
        id: initialRule?.id,
        scope_type: scopeType,
        title: title.trim(),
        target_amount: parsedAmount,
        category_filter: scopeType === 'CATEGORY' ? categoryFilter.trim() || title.trim() : undefined,
        account_id: scopeType === 'CARD' ? accountId || undefined : undefined,
        merchant_pattern:
          scopeType === 'MERCHANT' || scopeType === 'SUBSCRIPTIONS'
            ? merchantPattern.trim() || undefined
            : undefined,
        period_type: periodType,
        alert_thresholds: thresholds.length > 0 ? thresholds : [80, 100],
        pace_alert_enabled: paceAlert,
        notify_channels: channels,
        include_pending: true,
        is_active: true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <VitoSheet visible={visible} onClose={onClose} title="Configurar Limite de Gasto">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={[styles.label, { color: colors.muted }]}>Escopo do limite</Text>
        <View style={styles.chipRow}>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scopeType === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setScopeType(opt.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.finBg : colors.surf,
                    borderColor: active ? colors.fin : colors.line,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.fin : colors.ink }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Nome do limite</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex.: Cartão Nubank, Delivery, Assinaturas"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surf }]}
        />

        <Text style={[styles.label, { color: colors.muted }]}>Teto (R$)</Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="Ex.: 1500"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surf }]}
        />

        {scopeType === 'CATEGORY' && (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>Categoria</Text>
            <TextInput
              value={categoryFilter}
              onChangeText={setCategoryFilter}
              placeholder="Ex.: Delivery, Transporte, Lazer"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surf }]}
            />
          </>
        )}

        {scopeType === 'CARD' && creditCards.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>Cartão (opcional = todos)</Text>
            <View style={styles.chipRow}>
              {creditCards.map((c) => {
                const active = accountId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setAccountId(active ? '' : c.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.finBg : colors.surf,
                        borderColor: active ? colors.fin : colors.line,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.fin : colors.ink }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {(scopeType === 'MERCHANT' || scopeType === 'SUBSCRIPTIONS') && (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>
              Estabelecimento / App (opcional para todas as assinaturas)
            </Text>
            <TextInput
              value={merchantPattern}
              onChangeText={setMerchantPattern}
              placeholder="Ex.: iFood, Uber, Netflix"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surf }]}
            />
          </>
        )}

        <Text style={[styles.label, { color: colors.muted }]}>Período</Text>
        <View style={styles.chipRow}>
          {PERIOD_OPTIONS.map((p) => {
            const active = periodType === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriodType(p.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.finBg : colors.surf,
                    borderColor: active ? colors.fin : colors.line,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.fin : colors.ink }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Avisar ao atingir</Text>
        <View style={styles.chipRow}>
          {THRESHOLD_PRESETS.map((pct) => {
            const active = thresholds.includes(pct);
            return (
              <TouchableOpacity
                key={pct}
                onPress={() => toggleThreshold(pct)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.finBg : colors.surf,
                    borderColor: active ? colors.fin : colors.line,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.fin : colors.ink }]}>
                  {pct}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.ink }]}>Alerta de ritmo acelerado</Text>
          <Switch value={paceAlert} onValueChange={setPaceAlert} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.ink }]}>Notificação Push</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.ink }]}>Avisar no meu WhatsApp</Text>
          <Switch value={waEnabled} onValueChange={setWaEnabled} />
        </View>

        <TouchableOpacity
          disabled={saving}
          onPress={() => void handleSave()}
          style={[styles.saveBtn, { backgroundColor: colors.fin, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar limite'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: 28, gap: 10 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  switchLabel: { fontSize: 14 },
  saveBtn: { marginTop: 14, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#111111', fontSize: 15, fontWeight: '700' },
});
