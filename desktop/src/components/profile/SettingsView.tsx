import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { GmailStatus, SessionDevice, WhatsAppStatus } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  Brain,
  Calendar,
  Crown,
  Link2,
  LogOut,
  Mic,
  Monitor,
  Moon,
  RefreshCw,
  Sliders,
  Smartphone,
  Sparkles,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { PersonaStyleSelector } from './PersonaStyleSelector';
import { MemoryPanel } from './MemoryPanel';
import { AiProvidersPanel } from '../ai/AiProvidersPanel';
import { StorePage, StorePanel } from '../store/StorePanel';

type SettingsTab =
  | 'conta'
  | 'integracoes'
  | 'autonomia'
  | 'ia'
  | 'voz'
  | 'memoria'
  | 'aparencia'
  | 'dispositivos'
  | 'loja';

export const SettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('conta');
  const [storePage, setStorePage] = useState<StorePage>('pro');

  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [sessions, setSessions] = useState<SessionDevice[]>([]);
  const [intQuery, setIntQuery] = useState('');
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState(false);
  const [personaStyle, setPersonaStyle] = useState('balanced');
  const [autMode, setAutMode] = useState<'assisted' | 'proactive'>('assisted');
  const [focusBlocks, setFocusBlocks] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState<'puck' | 'kore'>('kore');

  useEffect(() => {
    const onOpenTab = (event: Event) => {
      const detail = (event as CustomEvent<SettingsTab>).detail;
      if (detail) setActiveTab(detail);
    };
    window.addEventListener('vito:open-settings-tab', onOpenTab);
    Promise.allSettled([
      api.getWhatsAppStatus().then(setWaStatus),
      api.getGmailStatus().then(setGmailStatus),
      api.getSessions().then(setSessions),
      api.getAISettings().then((s) => {
        if (s?.persona_style) setPersonaStyle(s.persona_style);
        if (s?.autonomy_mode === 'proactive') setAutMode('proactive');
        if (typeof s?.auto_focus_blocks === 'boolean') setFocusBlocks(s.auto_focus_blocks);
        if (s?.preferred_voice) {
          setPreferredVoice(s.preferred_voice.toLowerCase().includes('kore') ? 'kore' : 'puck');
        }
      }),
    ]);
    return () => window.removeEventListener('vito:open-settings-tab', onOpenTab);
  }, []);

  const handleSyncCalendarNow = async () => {
    setSyncingCalendar(true);
    setCalendarSyncSuccess(false);
    try {
      await api.syncCalendar('google');
      setCalendarSyncSuccess(true);
      setTimeout(() => setCalendarSyncSuccess(false), 3000);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const navItems = [
    { id: 'conta' as SettingsTab, label: 'Perfil & Conta', icon: UserIcon, desc: 'Dados e WhatsApp' },
    { id: 'integracoes' as SettingsTab, label: 'Integrações', icon: Link2, desc: 'Apps e calendários' },
    { id: 'autonomia' as SettingsTab, label: 'Autonomia', icon: Sliders, desc: 'Iniciativa e tom' },
    { id: 'ia' as SettingsTab, label: 'Provedores de IA', icon: Sparkles, desc: 'Chaves e modelos' },
    { id: 'voz' as SettingsTab, label: 'Voz e Ativação', icon: Mic, desc: 'Voz neural' },
    { id: 'memoria' as SettingsTab, label: 'Memória', icon: Brain, desc: 'Temas, episódios, fatos' },
    { id: 'aparencia' as SettingsTab, label: 'Aparência', icon: Sun, desc: 'Claro, Escuro, Sistema' },
    { id: 'dispositivos' as SettingsTab, label: 'Dispositivos', icon: Smartphone, desc: 'Sessões ativas' },
    { id: 'loja' as SettingsTab, label: 'Planos & LGPD', icon: Crown, desc: 'Assinatura, privacidade, FAQ' },
  ];

  const integrations = [
    { id: 'gcal', name: 'Google Agenda', desc: 'Eventos e horários livres', connected: true, soon: false },
    { id: 'gmail', name: 'Gmail', desc: 'Boletos, faturas e voos', connected: Boolean(gmailStatus?.connected), soon: false },
    { id: 'wa', name: 'WhatsApp', desc: 'Mensagens e avisos', connected: Boolean(waStatus?.connected), soon: false },
    { id: 'outlook', name: 'Outlook', desc: 'E-mails e agenda da Microsoft', connected: false, soon: false },
    { id: 'maps', name: 'Google Maps', desc: 'Rotas e trânsito', connected: false, soon: false },
    { id: 'trello', name: 'Trello', desc: 'Quadros, listas e cartões', connected: false, soon: false },
    { id: 'gdrive', name: 'Google Drive', desc: 'Arquivos e documentos', connected: false, soon: true },
    { id: 'notion', name: 'Notion', desc: 'Páginas e bases de dados', connected: false, soon: true },
    { id: 'slack', name: 'Slack', desc: 'Mensagens e canais', connected: false, soon: true },
  ].filter((x) => !intQuery.trim() || `${x.name} ${x.desc}`.toLowerCase().includes(intQuery.trim().toLowerCase()));

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none">
      <header className="h-16 px-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">Perfil & Configurações</h1>
          <p className="text-xs text-[var(--muted)]">Conta, autonomia, integrações, memória e loja</p>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-[270px] shrink-0 border-r border-[var(--line)] overflow-y-auto p-3.5 space-y-1.5 bg-[var(--bg)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                  active
                    ? 'bg-[var(--surf)] border border-[var(--ink)]'
                    : 'border border-transparent hover:bg-[var(--surf)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    active ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surf)] text-[var(--muted)]'
                  }`}
                >
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <b className={`text-sm block truncate ${active ? 'text-[var(--ink)]' : ''}`}>{item.label}</b>
                  <span className="text-[11px] text-[var(--muted)] block truncate">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-[var(--surf)]">
          <div className="max-w-3xl space-y-6">
            {activeTab === 'conta' && (
              <div className="space-y-4">
                <Card padding="lg" className="space-y-4 bg-[var(--bg)]">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-xl font-extrabold">
                      {user?.name?.slice(0, 2).toUpperCase() || 'AV'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <b className="text-lg block">{user?.name || 'André Victor'}</b>
                      <span className="text-sm text-[var(--muted)]">{user?.email || 'victorandre280@gmail.com'}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                      WhatsApp verificado
                    </span>
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Planos Pro e Ultra', p: 'pro' as StorePage },
                    { label: 'Privacidade e LGPD', p: 'priv' as StorePage },
                    { label: 'Notificações por categoria', p: 'notif' as StorePage },
                    { label: 'Ajuda, denúncias e FAQ', p: 'help' as StorePage },
                  ].map((s) => (
                    <button
                      key={s.p}
                      type="button"
                      onClick={() => {
                        setStorePage(s.p);
                        setActiveTab('loja');
                      }}
                      className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] text-left text-sm font-semibold hover:border-[var(--ink)]"
                    >
                      {s.label} →
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="md"
                  pill
                  onClick={logout}
                  className="text-[var(--red)] border-[var(--red)]"
                  leftIcon={<LogOut size={16} />}
                >
                  Encerrar sessão
                </Button>
              </div>
            )}

            {activeTab === 'integracoes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={intQuery}
                    onChange={(e) => setIntQuery(e.target.value)}
                    placeholder="Buscar integrações..."
                    className="flex-1 h-10 px-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    disabled={syncingCalendar}
                    onClick={handleSyncCalendarNow}
                    leftIcon={<RefreshCw size={14} className={syncingCalendar ? 'animate-spin' : ''} />}
                  >
                    {calendarSyncSuccess ? 'Sincronizado!' : 'Sincronizar agenda'}
                  </Button>
                </div>

                {[
                  { title: 'Conectadas', list: integrations.filter((x) => x.connected) },
                  { title: 'Disponíveis', list: integrations.filter((x) => !x.connected && !x.soon) },
                  { title: 'Em breve', list: integrations.filter((x) => x.soon) },
                ].map((sec) =>
                  sec.list.length > 0 ? (
                    <div key={sec.title} className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                        {sec.title} ({sec.list.length})
                      </h3>
                      <div className="rounded-2xl bg-[var(--bg)] border border-[var(--line)] divide-y divide-[var(--line)]">
                        {sec.list.map((it) => (
                          <div key={it.id} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Calendar size={18} className="text-[var(--blue)]" />
                              <div>
                                <b className="text-sm block">{it.name}</b>
                                <span className="text-xs text-[var(--muted)]">{it.desc}</span>
                              </div>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                it.connected
                                  ? 'bg-[var(--green-bg)] text-[var(--acc)]'
                                  : 'bg-[var(--surf)] text-[var(--muted)]'
                              }`}
                            >
                              {it.soon ? 'Avisar-me' : it.connected ? 'Conectado' : 'Conectar'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {activeTab === 'autonomia' && (
              <div className="space-y-4">
                <div className="flex rounded-full bg-[var(--bg)] p-1 border border-[var(--line)] w-fit">
                  {(
                    [
                      ['assisted', 'Assistido'],
                      ['proactive', 'Proativo'],
                    ] as const
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={async () => {
                        setAutMode(id);
                        await api.updateAISettings({ autonomy_mode: id }).catch(() => {});
                      }}
                      className={`px-4 h-9 rounded-full text-xs font-semibold ${
                        autMode === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <Card padding="lg" className="bg-[var(--bg)] flex items-center justify-between">
                  <div>
                    <b className="text-sm block">Blocos de foco</b>
                    <span className="text-xs text-[var(--muted)]">
                      Reserva janelas livres para trabalho profundo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !focusBlocks;
                      setFocusBlocks(next);
                      await api.updateAISettings({ auto_focus_blocks: next }).catch(() => {});
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                      focusBlocks ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        focusBlocks ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </Card>

                <Card padding="lg" className="space-y-3 bg-[var(--bg)]">
                  <b className="text-sm block">Tom das respostas</b>
                  <PersonaStyleSelector
                    value={personaStyle}
                    onChange={async (id) => {
                      setPersonaStyle(id);
                      await api.updateAISettings({ persona_style: id }).catch(() => {});
                    }}
                  />
                </Card>
              </div>
            )}

            {activeTab === 'ia' && <AiProvidersPanel />}

            {activeTab === 'voz' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Voz do assistente</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      { id: 'kore', label: 'Voz Feminina', sub: 'Tom caloroso e expressivo (Kore)' },
                      { id: 'puck', label: 'Voz Masculina', sub: 'Tom firme e conversacional (Puck)' },
                    ] as const
                  ).map((v) => {
                    const active = preferredVoice === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={async () => {
                          setPreferredVoice(v.id);
                          await api.updateAISettings({ preferred_voice: v.id }).catch(() => {});
                        }}
                        className={`p-4 rounded-2xl border-2 text-left bg-[var(--bg)] ${
                          active ? 'border-[var(--ink)]' : 'border-[var(--line)]'
                        }`}
                      >
                        <b className="text-sm block">{v.label}</b>
                        <span className="text-xs text-[var(--muted)]">{v.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'memoria' && <MemoryPanel />}

            {activeTab === 'aparencia' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Tema</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Escuro', icon: Moon },
                      { id: 'system', label: 'Sistema', icon: Monitor },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const active = themeMode === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setThemeMode(t.id)}
                        className={`p-4 rounded-2xl border-2 bg-[var(--bg)] flex flex-col items-center gap-2 ${
                          active ? 'border-[var(--ink)]' : 'border-[var(--line)]'
                        }`}
                      >
                        <Icon size={20} />
                        <b className="text-sm">{t.label}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'dispositivos' && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold">Dispositivos conectados ({sessions.length || 1})</h2>
                {sessions.map((s) => (
                  <Card key={s.id} padding="md" className="bg-[var(--bg)] flex items-center justify-between">
                    <div>
                      <b className="text-sm block">{s.device_name}</b>
                      <span className="text-xs text-[var(--muted)]">{s.ip_address}</span>
                    </div>
                    {s.is_current && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--green-bg)] text-[var(--acc)]">
                        Este aparelho
                      </span>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'loja' && <StorePanel initialPage={storePage} onLogout={logout} />}
          </div>
        </main>
      </div>
    </div>
  );
};
