import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon, type ProtoUiIconName } from '../icons/ProtoUiIcons';
import { BrandLogo } from '../icons/IconRegistry';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { calendarSyncService } from '../services/calendarSyncService';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { CalendarSyncSettingsModal } from '../components/profile/CalendarSyncSettingsModal';
import { GmailConnectModal } from '../components/profile/GmailConnectModal';
import { WhatsAppConnectModal } from '../components/profile/WhatsAppConnectModal';
import { integrationsStyles as styles } from './IntegrationsScreen.styles';

interface IntegrationItem {
  id: string;
  name: string;
  desc: string;
  category: 'Agenda' | 'E-mail' | 'Mensagens' | 'Mapas' | 'Projetos' | 'Arquivos';
  icon: ProtoUiIconName;
  color: string;
  connected: boolean;
  comingSoon?: boolean;
  actions: string[];
  detailSub?: string;
}

const SOON_ITEMS: IntegrationItem[] = [
  {
    id: 'gdrive',
    name: 'Google Drive',
    desc: 'Arquivos e documentos',
    category: 'Arquivos',
    icon: 'folder-open',
    color: '#0aa55c',
    connected: false,
    comingSoon: true,
    actions: ['Buscar documentos', 'Resumir PDFs'],
  },
  {
    id: 'notion',
    name: 'Notion',
    desc: 'Páginas e bases de dados',
    category: 'Projetos',
    icon: 'description',
    color: '#0a0a0a',
    connected: false,
    comingSoon: true,
    actions: ['Ler páginas', 'Criar notas'],
  },
  {
    id: 'slack',
    name: 'Slack',
    desc: 'Mensagens e canais da equipe',
    category: 'Mensagens',
    icon: 'forum',
    color: '#ff2fa0',
    connected: false,
    comingSoon: true,
    actions: ['Monitorar canais', 'Resumir menções'],
  },
];

export const IntegrationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('Todas');
  const [calConnected, setCalConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [waConnected, setWaConnected] = useState(false);
  const [localConnected, setLocalConnected] = useState<Record<string, boolean>>({});
  const [soonNotify, setSoonNotify] = useState<Record<string, boolean>>({});
  const [activeApp, setActiveApp] = useState<IntegrationItem | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [calModal, setCalModal] = useState(false);
  const [gmailModal, setGmailModal] = useState(false);
  const [waModal, setWaModal] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2500);
  };

  const loadStatuses = useCallback(async () => {
    const [cals, gm, wa] = await Promise.all([
      calendarSyncService.listIntegrations().catch(() => []),
      api.getGmailStatus().catch(() => ({ connected: false })),
      api.getWhatsAppStatus().catch(() => ({ status: 'disconnected' })),
    ]);
    setCalConnected(Array.isArray(cals) && cals.some((c) => c.status === 'active'));
    setGmailConnected(Boolean(gm?.connected));
    setGmailEmail((gm as { email?: string })?.email || '');
    setWaConnected(wa?.status === 'connected');
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const items = useMemo<IntegrationItem[]>(
    () => [
      {
        id: 'gcal',
        name: 'Google Agenda',
        desc: 'Eventos e horários livres',
        category: 'Agenda',
        icon: 'calendar-today',
        color: '#0a7cff',
        connected: calConnected,
        detailSub: calConnected ? 'Sincronização ativa' : 'Eventos e horários livres',
        actions: ['Ver horários livres', 'Criar evento'],
      },
      {
        id: 'gmail',
        name: 'Gmail',
        desc: 'Faturas, boletos e voos',
        category: 'E-mail',
        icon: 'mail-outline',
        color: '#ff2d46',
        connected: gmailConnected,
        detailSub: gmailEmail ? `${gmailEmail} · varredura ativa` : 'Varredura de boletos e voos',
        actions: ['Ler e-mails', 'Rascunhar resposta'],
      },
      {
        id: 'wa',
        name: 'WhatsApp',
        desc: 'Mensagens e avisos',
        category: 'Mensagens',
        icon: 'chat-bubble-outline',
        color: '#0aa55c',
        connected: waConnected,
        detailSub: waConnected ? 'Sessão ativa e pronta' : 'Mensagens e avisos',
        actions: ['Enviar mensagem', 'Avisos no WhatsApp'],
      },
      {
        id: 'outlook',
        name: 'Outlook',
        desc: 'E-mails e agenda da Microsoft',
        category: 'E-mail',
        icon: 'mark-email-read',
        color: '#0a7cff',
        connected: !!localConnected.outlook,
        actions: ['Ler e-mails do Outlook', 'Criar evento no Outlook'],
      },
      {
        id: 'maps',
        name: 'Google Maps',
        desc: 'Rotas, trânsito e locais',
        category: 'Mapas',
        icon: 'place',
        color: '#0aa55c',
        connected: !!localConnected.maps,
        actions: ['Calcular rota e tempo', 'Avisar a hora de sair'],
      },
      {
        id: 'trello',
        name: 'Trello',
        desc: 'Quadros, listas e cartões',
        category: 'Projetos',
        icon: 'dashboard',
        color: '#0aa5b5',
        connected: !!localConnected.trello,
        actions: ['Criar cartão', 'Mover cartão'],
      },
      {
        id: 'telegram',
        name: 'Telegram',
        desc: 'Avisos e comandos pelo seu bot',
        category: 'Mensagens',
        icon: 'send',
        color: '#0a7cff',
        connected: !!localConnected.telegram,
        actions: ['Avisar no Telegram', 'Receber comandos'],
      },
    ],
    [calConnected, gmailConnected, gmailEmail, waConnected, localConnected]
  );

  const categories = ['Todas', 'Agenda', 'E-mail', 'Mensagens', 'Mapas', 'Projetos', 'Arquivos'];
  const q = query.trim().toLowerCase();
  const matches = (it: IntegrationItem) =>
    (selectedCat === 'Todas' || it.category === selectedCat) &&
    (!q || `${it.name} ${it.desc} ${it.category}`.toLowerCase().includes(q));

  const connectedList = items.filter((i) => i.connected && matches(i));
  const availableList = items.filter((i) => !i.connected && matches(i));
  const soonList = SOON_ITEMS.filter(matches);
  const totalConnected = items.filter((i) => i.connected).length;
  const totalAvailable = items.length - totalConnected;

  const handleConnectAction = async (app: IntegrationItem) => {
    setActiveApp(null);
    if (app.id === 'gcal') return setCalModal(true);
    if (app.id === 'gmail') return setGmailModal(true);
    if (app.id === 'wa') return setWaModal(true);
    setLocalConnected((prev) => ({ ...prev, [app.id]: !app.connected }));
    showToast(app.connected ? `${app.name} desconectado` : `${app.name} conectado`);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.sbar, { borderBottomColor: colors.line }]}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>Integrações</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {totalConnected} conectadas · {totalAvailable} disponíveis
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.ink, borderColor: colors.ink }]}
          onPress={() => setSuggestOpen(true)}
          accessibilityLabel="Sugerir um app"
        >
          <ProtoUiIcon name="add" size={22} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <ProtoUiIcon name="search" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.ink }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar integrações"
            placeholderTextColor={colors.muted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {categories.map((cat) => {
            const active = selectedCat === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedCat(cat);
                }}
              >
                <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {[
          { title: 'Conectadas', list: connectedList, soon: false },
          { title: 'Disponíveis', list: availableList, soon: false },
          { title: 'Em breve', list: soonList, soon: true },
        ].map((sec) =>
          sec.list.length > 0 ? (
            <View key={sec.title} style={styles.section}>
              <View style={styles.secHeader}>
                <Text style={[styles.secTitle, { color: colors.ink }]}>{sec.title}</Text>
                <Text style={[styles.secCount, { color: colors.muted }]}>{sec.list.length}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
                {sec.list.map((it, idx) => {
                  const notified = !!soonNotify[it.id];
                  return (
                    <TouchableOpacity
                      key={it.id}
                      style={[
                        styles.row,
                        idx > 0 && { borderTopWidth: 0.5, borderTopColor: colors.line },
                      ]}
                      onPress={() => {
                        if (sec.soon) {
                          hapticFeedback.selection();
                          setSoonNotify((prev) => ({ ...prev, [it.id]: !prev[it.id] }));
                          showToast(!notified ? 'Avisaremos quando chegar' : 'Aviso cancelado');
                          return;
                        }
                        setActiveApp(it);
                      }}
                    >
                      <View style={[styles.appIcon, { backgroundColor: colors.bg }]}>
                        {['gcal', 'gmail', 'wa', 'maps', 'trello', 'telegram', 'gdrive', 'notion', 'slack', 'outlook'].includes(it.id) ? (
                          <BrandLogo group="app" id={it.id} size={22} color={it.color} />
                        ) : (
                          <ProtoUiIcon name={it.icon} size={20} color={it.color} />
                        )}
                      </View>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, { color: colors.ink }]}>{it.name}</Text>
                        <Text style={[styles.rowSub, { color: colors.muted }]}>{it.desc}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: it.connected || notified ? colors.greenBg : colors.bg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: it.connected || notified ? colors.acc : colors.ink },
                          ]}
                        >
                          {sec.soon
                            ? notified
                              ? '✓ Avisaremos'
                              : 'Avisar-me'
                            : it.connected
                              ? '✓ Conectado'
                              : 'Conectar'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null
        )}

        {connectedList.length === 0 && availableList.length === 0 && soonList.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>Nenhuma integração encontrada.</Text>
        )}
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toast}</Text>
        </View>
      )}

      <BottomSheetModal
        visible={!!activeApp}
        onClose={() => setActiveApp(null)}
        title={activeApp?.name || ''}
        subtitle={activeApp?.category || 'Integração'}
      >
        {activeApp && (
          <View style={styles.sheetBody}>
            <Text style={[styles.sheetDesc, { color: colors.muted }]}>
              {activeApp.connected ? activeApp.detailSub || 'Conectado' : activeApp.desc}
            </Text>
            <Text style={[styles.sheetLabel, { color: colors.muted }]}>O que o Vito pode fazer</Text>
            <View style={styles.tagsWrap}>
              {activeApp.actions.map((a) => (
                <View key={a} style={[styles.tag, { backgroundColor: colors.surf }]}>
                  <Text style={[styles.tagText, { color: colors.ink }]}>{a}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sheetBtns}>
              {activeApp.connected && (
                <TouchableOpacity
                  style={[styles.priBtn, { backgroundColor: colors.ink }]}
                  onPress={async () => {
                    if (activeApp.id === 'gcal') await api.syncCalendar('google').catch(() => {});
                    setActiveApp(null);
                    showToast(`${activeApp.name} sincronizado agora`);
                  }}
                >
                  <Text style={[styles.priBtnText, { color: colors.bg }]}>Sincronizar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  activeApp.connected ? styles.dngBtn : styles.priBtn,
                  activeApp.connected
                    ? { borderColor: colors.red }
                    : { backgroundColor: colors.ink },
                ]}
                onPress={() => handleConnectAction(activeApp)}
              >
                <Text
                  style={[
                    styles.priBtnText,
                    { color: activeApp.connected ? colors.red : colors.bg },
                  ]}
                >
                  {activeApp.connected ? 'Desconectar' : `Conectar ${activeApp.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        visible={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        title="Sugerir integração"
        subtitle="Qual app você gostaria de conectar ao Vito?"
      >
        <View style={styles.sheetBody}>
          <TextInput
            style={[styles.suggestInput, { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink }]}
            value={suggestName}
            onChangeText={setSuggestName}
            placeholder="Ex.: Todoist, Asana, Linear..."
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink, marginTop: 14 }]}
            onPress={async () => {
              if (suggestName.trim()) {
                await api.suggestBotApp(suggestName.trim(), 'Sugestão via Integrações').catch(() => {});
              }
              setSuggestName('');
              setSuggestOpen(false);
              showToast('Sugestão enviada!');
            }}
          >
            <Text style={[styles.priBtnText, { color: colors.bg }]}>Enviar sugestão</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      <CalendarSyncSettingsModal
        visible={calModal}
        onClose={() => { setCalModal(false); loadStatuses(); }}
        onDataChanged={loadStatuses}
      />
      <GmailConnectModal
        visible={gmailModal}
        onClose={() => { setGmailModal(false); loadStatuses(); }}
        onStatusChanged={loadStatuses}
      />
      <WhatsAppConnectModal
        visible={waModal}
        onClose={() => { setWaModal(false); loadStatuses(); }}
        onStatusChanged={loadStatuses}
      />
    </SafeAreaView>
  );
};
