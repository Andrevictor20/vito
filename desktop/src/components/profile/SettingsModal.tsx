import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { WhatsAppStatus, GmailStatus, SessionDevice } from '../../types';
import { GoogleIcon } from '../common/GoogleIcon';
import {
  X,
  User as UserIcon,
  Link2,
  Sliders,
  Smartphone,
  LogOut,
  Moon,
  Sun,
  Laptop,
  RefreshCw,
  Mail,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'conta' | 'integracoes' | 'geral' | 'ia' | 'sessoes';

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('conta');
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [sessions, setSessions] = useState<SessionDevice[]>([]);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.allSettled([
      api.getWhatsAppStatus().then(setWaStatus),
      api.getGmailStatus().then(setGmailStatus),
      api.getSessions().then(setSessions),
    ]);
  }, [open]);

  if (!open) return null;

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

  const navItems = [
    { id: 'conta' as SettingsTab, label: 'Conta', icon: UserIcon },
    { id: 'integracoes' as SettingsTab, label: 'Integrações', icon: Link2 },
    { id: 'ia' as SettingsTab, label: 'Inteligência & IA', icon: Sparkles },
    { id: 'geral' as SettingsTab, label: 'Geral & Aparência', icon: Sliders },
    { id: 'sessoes' as SettingsTab, label: 'Sessões', icon: Smartphone },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl h-[620px] max-h-[90vh] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] shadow-2xl flex overflow-hidden text-zinc-900 dark:text-[#FAFAFA] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Coluna Esquerda: Navegação Toki */}
        <div className="w-64 bg-zinc-50/80 dark:bg-[#0E1014] border-r border-zinc-200 dark:border-[#222730] flex flex-col justify-between p-4 shrink-0">
          <div>
            <div className="flex items-center justify-between px-3 py-2 mb-3">
              <h3 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                Configurações
              </h3>
            </div>


            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-zinc-200 dark:bg-[#1C2026] text-zinc-900 dark:text-white font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Rodapé da Coluna Esquerda: Sair */}
          <div className="pt-3 border-t border-zinc-200 dark:border-[#222730]">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>

        {/* Coluna Direita: Conteúdo Ativo */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar com Título e Fechar */}
          <div className="h-14 px-6 border-b border-zinc-200 dark:border-[#222730] flex items-center justify-between shrink-0">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
              {activeTab}
            </h4>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Área de rolagem do conteúdo */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB: CONTA */}
            {activeTab === 'conta' && (
              <div className="space-y-5">
                {/* User Hero Card */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
                      {user?.name ? user.name[0].toUpperCase() : 'A'}
                    </div>
                    <div>
                      <h5 className="text-base font-bold text-zinc-900 dark:text-white">
                        {user?.name || 'ANDRE VICTOR'}
                      </h5>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Seu perfil público e identificação no Vito
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                    <span>Ver perfil</span>
                    <ExternalLink size={12} />
                  </span>
                </div>

                {/* E-mail e Nome de Usuário */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33]">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
                      <Mail size={14} />
                      <span>E-mail cadastrado</span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {user?.email || 'victorandre280@gmail.com'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33]">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
                      <UserIcon size={14} />
                      <span>Nome de usuário</span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {(user?.email || 'victorandre280').split('@')[0]}@vito.ai
                    </p>
                  </div>
                </div>

                {/* Métodos de Login */}
                <div className="space-y-3 pt-2">
                  <h6 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Métodos de Login Conectados
                  </h6>

                  <div className="rounded-2xl border border-zinc-200 dark:border-[#262B33] bg-zinc-50 dark:bg-[#181C22] divide-y divide-zinc-200 dark:divide-[#262B33] overflow-hidden">
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GoogleIcon size={18} />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white">Google OAuth</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user?.email || 'victorandre280@gmail.com'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Conectado ✓</span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare size={18} className="text-emerald-500" />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white">WhatsApp Passwordless</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user?.phone || 'Autenticação sem senha via código'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ativo</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: INTEGRAÇÕES */}
            {activeTab === 'integracoes' && (
              <div className="space-y-5">
                {/* Calendários de Terceiros */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h6 className="text-sm font-bold text-zinc-900 dark:text-white">Calendários de Terceiros</h6>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Sincronização bidirecional de eventos e reuniões</p>
                    </div>
                    <button
                      onClick={handleSyncCalendarNow}
                      disabled={syncingCalendar}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-200 dark:bg-[#222730] hover:bg-zinc-300 dark:hover:bg-[#2C323E] text-xs font-semibold text-zinc-900 dark:text-white transition-colors"
                    >
                      <RefreshCw size={13} className={syncingCalendar ? 'animate-spin' : ''} />
                      <span>{calendarSyncSuccess ? 'Sincronizado!' : syncingCalendar ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GoogleIcon size={20} />
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Google Calendar</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user?.email || 'victorandre280@gmail.com'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">1 Conectado</span>
                  </div>
                </div>

                {/* Gmail Scanner */}
                <div className="space-y-3 pt-2">
                  <h6 className="text-sm font-bold text-zinc-900 dark:text-white">Leitor de E-mails Inteligente</h6>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                        <Mail size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Gmail (Boletos, Faturas & Voos)</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {gmailStatus?.email ? `Varredura ativa (${gmailStatus.email})` : 'Varredura ativa conectada ao Google'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Ativo</span>
                  </div>
                </div>

                {/* WhatsApp Bot */}
                <div className="space-y-3 pt-2">
                  <h6 className="text-sm font-bold text-zinc-900 dark:text-white">WhatsApp Assistente</h6>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <MessageSquare size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">WhatsApp Companion (@vito)</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Pronto para responder menções em grupos e conversas privadas</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {waStatus?.connected ? 'Conectado' : 'Conectado'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: IA */}
            {activeTab === 'ia' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181C22] border border-zinc-200 dark:border-[#262B33] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">Modo de Autonomia da IA</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Controle a pró-atividade do Vito em compromissos e tarefas</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      className="p-3.5 rounded-xl border-2 border-indigo-500 bg-indigo-500/5 text-left text-xs font-medium"
                    >
                      <p className="font-bold text-zinc-900 dark:text-white mb-0.5">Pró-ativo (Recomendado)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Vito sugere ações, vigias e resoluções com antecedência</p>
                    </button>
                    <button
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-[#262B33] text-left text-xs font-medium hover:border-zinc-400"
                    >
                      <p className="font-bold text-zinc-900 dark:text-white mb-0.5">Assistido</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Executa apenas quando solicitado expressamente</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GERAL & APARÊNCIA */}
            {activeTab === 'geral' && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <h6 className="text-sm font-bold text-zinc-900 dark:text-white">Aparência do Aplicativo</h6>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setThemeMode('light')}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        themeMode === 'light'
                          ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/10 font-bold'
                          : 'border-zinc-200 dark:border-[#262B33] bg-zinc-50 dark:bg-[#181C22]'
                      }`}
                    >
                      <Sun size={20} className="mx-auto mb-2 text-amber-500" />
                      <p className="text-xs">Claro</p>
                    </button>

                    <button
                      onClick={() => setThemeMode('dark')}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        themeMode === 'dark'
                          ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/10 font-bold'
                          : 'border-zinc-200 dark:border-[#262B33] bg-zinc-50 dark:bg-[#181C22]'
                      }`}
                    >
                      <Moon size={20} className="mx-auto mb-2 text-indigo-400" />
                      <p className="text-xs">Escuro</p>
                    </button>

                    <button
                      onClick={() => setThemeMode('system')}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        themeMode === 'system'
                          ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/10 font-bold'
                          : 'border-zinc-200 dark:border-[#262B33] bg-zinc-50 dark:bg-[#181C22]'
                      }`}
                    >
                      <Laptop size={20} className="mx-auto mb-2 text-zinc-400" />
                      <p className="text-xs">Sistema</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SESSÕES */}
            {activeTab === 'sessoes' && (
              <div className="space-y-4">
                <h6 className="text-sm font-bold text-zinc-900 dark:text-white">Aparelhos com Sessão Ativa</h6>
                <div className="rounded-2xl border border-zinc-200 dark:border-[#262B33] bg-zinc-50 dark:bg-[#181C22] divide-y divide-zinc-200 dark:divide-[#262B33] overflow-hidden">
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Laptop size={18} className="text-zinc-400" />
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white">Este Computador (Desktop Web)</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Ativo agora</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                      Atual
                    </span>
                  </div>

                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <div key={s.id} className="p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {s.device_name?.toLowerCase().includes('phone') || s.device_name?.toLowerCase().includes('mobile') || s.device_name?.toLowerCase().includes('android') ? (
                            <Smartphone size={18} className="text-zinc-400" />
                          ) : (
                            <Laptop size={18} className="text-zinc-400" />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white">{s.device_name || 'Aparelho Conectado'}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{s.ip_address} • {s.last_used_at}</p>
                          </div>
                        </div>
                        {s.is_current ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                            Atual
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">Conectado</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone size={18} className="text-zinc-400" />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white">Vito Mobile (Android)</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Sincronizado</p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">Conectado</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
