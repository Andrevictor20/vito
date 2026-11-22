import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NotificationCategoryPreferences,
} from '../services/api/inboxNotificationsApi';
import {
  BillingCycle,
  DEFAULT_PRIVACY_SETTINGS,
  PrivacyPermissionsState,
  PrivacySettingsState,
  UserSubscriptionState,
} from '../services/api/storeComplianceApi';
import type { StorePage } from '../navigation/screensNav';
import { StoreProView, StorePrivView } from '../components/store/StoreProPrivViews';
import { StoreAboutView, StoreHelpView, StoreNotifView } from '../components/store/StoreInfoViews';
import { StoreActiveSheet, StoreSheets } from '../components/store/StoreSheets';
import appJson from '../../app.json';

const PAGE_HEADERS: Record<StorePage, [string, string]> = {
  pro: ['Planos do Vito', 'Escolha o plano ideal'],
  priv: ['Privacidade e dados', 'Você no controle'],
  notif: ['Notificações', 'Escolha o que o Vito envia'],
  help: ['Ajuda e suporte', 'Respondemos em até 1 dia útil'],
  about: ['Sobre o Vito', 'Versão e informações legais'],
};

export const StoreScreen: React.FC = () => {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params?: { page?: StorePage } }>();
  const page: StorePage = route.params?.page || 'pro';

  const [subscription, setSubscription] = useState<UserSubscriptionState>({
    plan: 'free',
    billing_cycle: 'year',
    status: 'inactive',
  });
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'ultra'>('pro');
  const [billing, setBilling] = useState<BillingCycle>('year');
  const [privacy, setPrivacy] = useState<PrivacySettingsState>(DEFAULT_PRIVACY_SETTINGS);
  const [notifPrefs, setNotifPrefs] = useState<NotificationCategoryPreferences>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [activeSheet, setActiveSheet] = useState<StoreActiveSheet>(null);
  const [exportDone, setExportDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2600);
  };

  useEffect(() => {
    if (page === 'pro') {
      api.store.getSubscription().then((s) => setSubscription(s)).catch(() => {});
    } else if (page === 'priv') {
      api.store.getPrivacySettings().then((s) => setPrivacy(s)).catch(() => {});
    } else if (page === 'notif') {
      api.inbox.getPreferences().then((p) => setNotifPrefs(p)).catch(() => {});
    }
  }, [page]);

  const appVersion =
    (appJson as { expo?: { version?: string } })?.expo?.version ?? '1.0.0';
  const [title, subtitle] = PAGE_HEADERS[page];

  const handleStartTrial = async () => {
    setBusy(true);
    try {
      const sub = await api.store.subscribe(selectedPlan, billing).catch(() => ({
        plan: selectedPlan,
        billing_cycle: billing,
        status: 'trialing',
      }));
      setSubscription(sub);
      showToast(`Teste grátis do Vito ${selectedPlan === 'pro' ? 'Pro' : 'Ultra'} ativado`);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    showToast('Buscando compras…');
    try {
      const res = await api.store.restorePurchases();
      if (res.restored && res.subscription) {
        setSubscription(res.subscription);
        showToast('Assinatura restaurada');
      } else {
        showToast('Nenhuma compra anterior encontrada');
      }
    } catch {
      showToast('Nenhuma compra anterior encontrada');
    }
  };

  const handleTogglePerm = async (k: keyof PrivacyPermissionsState) => {
    const next: PrivacySettingsState = {
      ...privacy,
      permissions: { ...privacy.permissions, [k]: !privacy.permissions[k] },
    };
    setPrivacy(next);
    await api.store.updatePrivacySettings(next).catch(() => {});
  };

  const handleExport = async () => {
    setExportDone(false);
    setActiveSheet('export');
    await api.store.exportAccountData().catch(() => {});
    setTimeout(() => {
      setExportDone(true);
      showToast('Exportação enviada por e-mail');
    }, 900);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.sbar, { borderBottomColor: colors.line }]}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {page === 'pro' && (
          <StoreProView
            subscription={subscription}
            selectedPlan={selectedPlan}
            billing={billing}
            busy={busy}
            onSelectPlan={setSelectedPlan}
            onChangeBilling={setBilling}
            onStartTrial={handleStartTrial}
            onRestore={handleRestore}
            onOpenDoc={(d) => setActiveSheet(d)}
          />
        )}
        {page === 'priv' && (
          <StorePrivView
            privacy={privacy}
            onTogglePermission={handleTogglePerm}
            onToggleAi={async () => {
              const next = { ...privacy, ai_processing_enabled: !privacy.ai_processing_enabled };
              setPrivacy(next);
              await api.store.updatePrivacySettings(next).catch(() => {});
            }}
            onToggleDiag={async () => {
              const next = { ...privacy, analytics_enabled: !privacy.analytics_enabled };
              setPrivacy(next);
              await api.store.updatePrivacySettings(next).catch(() => {});
            }}
            onExport={handleExport}
            onDeleteAccount={() => setActiveSheet('delete')}
          />
        )}
        {page === 'notif' && (
          <StoreNotifView
            prefs={notifPrefs}
            systemNotifAllowed={privacy.permissions.notifications}
            onTogglePref={async (k) => {
              const next = { ...notifPrefs, [k]: !notifPrefs[k] };
              setNotifPrefs(next);
              await api.inbox.updatePreferences({ [k]: next[k] }).catch(() => {});
            }}
          />
        )}
        {page === 'help' && (
          <StoreHelpView
            onOpenContact={() => setActiveSheet('contact')}
            onOpenReport={() => setActiveSheet('report')}
            onOpenRate={() => setActiveSheet('rate')}
          />
        )}
        {page === 'about' && (
          <StoreAboutView appVersion={appVersion} onOpenDoc={(d) => setActiveSheet(d)} />
        )}
      </ScrollView>

      <StoreSheets
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        exportDone={exportDone}
        onSendSupport={async (msg) => {
          await api.store.sendSupportContact(msg).catch(() => {});
          setActiveSheet(null);
          showToast('Mensagem enviada. Respondemos por e-mail.');
        }}
        onReportAi={async (reason) => {
          await api.store.reportAiContent(reason).catch(() => {});
          setActiveSheet(null);
          showToast('Denúncia enviada. Obrigado!');
        }}
        onRateApp={(s) => {
          setActiveSheet(null);
          showToast(s >= 4 ? 'Abrindo a loja…' : 'Obrigado pelo feedback!');
        }}
        onConfirmDelete={async (confirmation) => {
          await api.store.deleteAccount(confirmation).catch(() => {});
          setActiveSheet(null);
          showToast('Conta agendada para exclusão em 30 dias');
          setTimeout(() => logout(), 700);
        }}
      />

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rb: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ttl: { flex: 1 },
  h1: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  sub: { fontSize: 12.5, marginTop: 1 },
  content: { padding: 16, paddingBottom: 60 },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontSize: 13, fontWeight: '600' },
});
