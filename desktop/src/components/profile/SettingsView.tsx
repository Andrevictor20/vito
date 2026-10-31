import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { WhatsAppStatus, GmailStatus, SessionDevice } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  User as UserIcon,
  Link2,
  Sparkles,
  Sliders,
  Smartphone,
  LogOut,
  Moon,
  Sun,
  Monitor,
  RefreshCw,
  Mail,
  MessageSquare,
  Calendar,
  Brain,
} from 'lucide-react';
import { PersonaStyleSelector } from './PersonaStyleSelector';
import { UserMemoriesModal } from './UserMemoriesModal';

type SettingsTab = 'conta' | 'integracoes' | 'ia' | 'aparencia' | 'notificacoes' | 'dispositivos';

export const SettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('conta');

  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [sessions, setSessions] = useState<SessionDevice[]>([]);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState(false);
  const [personaStyle, setPersonaStyle] = useState('balanced');
  const [isMemoriesOpen, setIsMemoriesOpen] = useState(false);

  // Switches interativos
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [confirmDestructive, setConfirmDestructive] = useState(true);
  const [voiceActivation, setVoiceActivation] = useState(false);
  const [taskReminders, setTaskReminders] = useState(true);
  const [radarAlerts, setRadarAlerts] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.getWhatsAppStatus().then(setWaStatus),
      api.getGmailStatus().then(setGmailStatus),
      api.getSessions().then(setSessions),
      api.getAISettings().then((s) => {
        if (s?.persona_style) setPersonaStyle(s.persona_style);
      }),
    ]);
  }, []);

  const handleSyncCalendarNow = async () => {
    setSyncingCalendar(true);
    setCalendarSyncSuccess(false);
    try {
      await api.syncCalendar('google');
      setCalendarSyncSuccess(true);
      setTimeout(() => setCalendarSyncSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao sincronizar calendário:', err);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handlePersonaChange = async (styleId: string) => {
    setPersonaStyle(styleId);
    try {
      await api.updateAISettings({ persona_style: styleId });
    } catch {
      // Ignora erro local
    }
  };

  const navItems = [
    { id: 'conta' as SettingsTab, label: 'Conta', icon: UserIcon, desc: 'Perfil e credenciais' },
    { id: 'integracoes' as SettingsTab, label: 'Integrações', icon: Link2, desc: 'Google, WhatsApp, CalDAV' },
    { id: 'ia' as SettingsTab, label: 'Inteligência & IA', icon: Sparkles, desc: 'Persona, autonomia e memórias' },
    { id: 'aparencia' as SettingsTab, label: 'Aparência', icon: Sliders, desc: 'Tema e interface' },
    { id: 'notificacoes' as SettingsTab, label: 'Notificações', icon: MessageSquare, desc: 'Alertas e lembretes' },
    { id: 'dispositivos' as SettingsTab, label: 'Dispositivos', icon: Smartphone, desc: 'Sessões conectadas' },
  ];

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none transition-colors duration-200">
      {/* Header Fiel ao Vito Desktop.html */}
      <header className="h-20 px-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] z-10 shrink-0">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight leading-tight">
            Configurações
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Conta, integrações e inteligência artificial
          </p>
        </div>
      </header>

      {/* Split-Pane de Duas Colunas (Menu 280px + Área Central max-w-4xl) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Menu Lateral de Seções */}
        <aside className="w-[280px] shrink-0 border-r border-[var(--line)] overflow-y-auto p-4 space-y-2 bg-[var(--bg)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all ${
                  isSelected
                    ? 'bg-[var(--surf)] border border-[var(--ink)] shadow-xs'
                    : 'border border-transparent hover:bg-[var(--surf)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : 'bg-[var(--surf)] text-[var(--muted)]'
                  }`}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <b className={`text-base block truncate ${isSelected ? 'text-[var(--ink)]' : 'text-inherit'}`}>
                    {item.label}
                  </b>
                  <span className="text-xs text-[var(--muted)] block truncate">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Área de Conteúdo da Seção Selecionada */}
        <main className="flex-1 overflow-y-auto p-8 bg-[var(--surf)]">
          <div className="max-w-3xl space-y-6">
            {/* 1. CONTA */}
            {activeTab === 'conta' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Dados da Conta</h2>

                <Card padding="lg" className="space-y-4 bg-[var(--bg)]">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-xl font-extrabold shadow-sm">
                      {user?.name?.slice(0, 1).toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <b className="text-lg text-[var(--ink)] block">{user?.name || 'André Victor'}</b>
                      <span className="text-sm text-[var(--muted)]">{user?.email || 'victorandre280@gmail.com'}</span>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                      Google Conectado
                    </span>
                  </div>

                  <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">WhatsApp sem senha</b>
                      <span className="text-sm text-[var(--muted)]">+55 98 •••• 7165</span>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                      Ativo
                    </span>
                  </div>
                </Card>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    pill
                    onClick={logout}
                    className="text-[var(--red)] border-[var(--red)] hover:bg-[var(--red-bg)]"
                    leftIcon={<LogOut size={16} />}
                  >
                    Sair da conta
                  </Button>
                </div>
              </div>
            )}

            {/* 2. INTEGRAÇÕES */}
            {activeTab === 'integracoes' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Integrações Conectadas</h2>

                {/* Google Calendar */}
                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">Google Calendar</b>
                      <span className="text-sm text-[var(--muted)]">Sincronização bidirecional de reuniões e eventos</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    disabled={syncingCalendar}
                    onClick={handleSyncCalendarNow}
                    leftIcon={<RefreshCw size={14} className={syncingCalendar ? 'animate-spin' : ''} />}
                  >
                    {syncingCalendar ? 'Sincronizando...' : calendarSyncSuccess ? 'Sincronizado!' : 'Sincronizar agora'}
                  </Button>
                </Card>

                {/* Apple CalDAV */}
                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--purple-bg)] text-[var(--purple)] flex items-center justify-center">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">Apple CalDAV</b>
                      <span className="text-sm text-[var(--muted)]">iCloud Calendar via senha de app</span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--surf)] text-[var(--muted)]">
                    Pronto para parear
                  </span>
                </Card>

                {/* Gmail */}
                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--red-bg)] text-[var(--red)] flex items-center justify-center">
                      <Mail size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">Gmail</b>
                      <span className="text-sm text-[var(--muted)]">Varredura de boletos, faturas e voos</span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                    {gmailStatus?.connected ? 'Conectado' : 'Conectado (Google)'}
                  </span>
                </Card>

                {/* WhatsApp */}
                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--green-bg)] text-[var(--acc)] flex items-center justify-center">
                      <MessageSquare size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">WhatsApp (@vito)</b>
                      <span className="text-sm text-[var(--muted)]">Assistente pessoal ativo no WhatsApp via Evolution API</span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                    {waStatus?.connected ? 'Online' : 'Conectado'}
                  </span>
                </Card>
              </div>
            )}

            {/* 3. INTELIGÊNCIA & IA */}
            {activeTab === 'ia' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Autonomia & Estilo da IA</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={() => setIsMemoriesOpen(true)}
                    leftIcon={<Brain size={14} className="text-[var(--purple)]" />}
                  >
                    O que o Vito sabe sobre mim
                  </Button>
                </div>

                {/* Estilo de Conversação */}
                <Card padding="lg" className="space-y-3 bg-[var(--bg)]">
                  <b className="text-base text-[var(--ink)] block">Estilo de Comunicação do Vito</b>
                  <PersonaStyleSelector value={personaStyle} onChange={handlePersonaChange} />
                </Card>

                {/* Switches de Autonomia */}
                <Card padding="lg" className="space-y-4 bg-[var(--bg)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">Modo Pró-ativo (Recomendado)</b>
                      <span className="text-sm text-[var(--muted)]">Vito sugere resoluções e alertas com antecedência</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProactiveEnabled(!proactiveEnabled)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        proactiveEnabled ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          proactiveEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">Pedir confirmação em ações de envio</b>
                      <span className="text-sm text-[var(--muted)]">Evita disparo automático de e-mails e mensagens no WhatsApp</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDestructive(!confirmDestructive)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        confirmDestructive ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          confirmDestructive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">Ativação por voz rápida</b>
                      <span className="text-sm text-[var(--muted)]">Abrir microfone ao pressionar a tecla Espaço no chat</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVoiceActivation(!voiceActivation)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        voiceActivation ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          voiceActivation ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </Card>
              </div>
            )}

            {/* 4. APARÊNCIA */}
            {activeTab === 'aparencia' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Tema do Sistema</h2>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'light', label: 'Claro', icon: Sun, desc: 'Canvas limpo' },
                    { id: 'dark', label: 'Escuro', icon: Moon, desc: 'OLED #0d0f10' },
                    { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Automático' },
                  ].map((theme) => {
                    const Icon = theme.icon;
                    const isCurrent = themeMode === theme.id;

                    return (
                      <Card
                        key={theme.id}
                        interactive
                        padding="lg"
                        onClick={() => setThemeMode(theme.id as any)}
                        className={`cursor-pointer text-center space-y-2 transition-all bg-[var(--bg)] ${
                          isCurrent ? 'ring-2 ring-[var(--ink)] border-[var(--ink)]' : 'hover:border-[var(--muted)]'
                        }`}
                      >
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--surf)] flex items-center justify-center text-[var(--ink)]">
                          <Icon size={24} />
                        </div>
                        <b className="text-base text-[var(--ink)] block">{theme.label}</b>
                        <span className="text-xs text-[var(--muted)] block">{theme.desc}</span>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. NOTIFICAÇÕES */}
            {activeTab === 'notificacoes' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Alertas e Notificações</h2>

                <Card padding="lg" className="space-y-4 bg-[var(--bg)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">Lembretes de Tarefas</b>
                      <span className="text-sm text-[var(--muted)]">Notificações no horário programado da tarefa</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTaskReminders(!taskReminders)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        taskReminders ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          taskReminders ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                    <div>
                      <b className="text-base text-[var(--ink)] block">Alertas Urgentes de Radares</b>
                      <span className="text-sm text-[var(--muted)]">Destaque imediato quando houver queda crítica de preço ou edital</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRadarAlerts(!radarAlerts)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        radarAlerts ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          radarAlerts ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </Card>
              </div>
            )}

            {/* 6. DISPOSITIVOS */}
            {activeTab === 'dispositivos' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Dispositivos Conectados</h2>

                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--green-bg)] text-[var(--acc)] flex items-center justify-center">
                      <Monitor size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">Este Computador (Desktop Web)</b>
                      <span className="text-sm text-[var(--muted)]">Sessão ativa agora</span>
                    </div>
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                    Atual
                  </span>
                </Card>

                <Card padding="lg" className="flex items-center justify-between bg-[var(--bg)]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center">
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <b className="text-base text-[var(--ink)] block">Android (Vito App)</b>
                      <span className="text-sm text-[var(--muted)]">
                        {sessions.length > 0 ? `${sessions.length} sessões ativas` : 'Conectado com Gemini Live Voice'}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" pill>
                    Encerrar
                  </Button>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Memórias da IA */}
      <UserMemoriesModal isOpen={isMemoriesOpen} onClose={() => setIsMemoriesOpen(false)} />
    </div>
  );
};
