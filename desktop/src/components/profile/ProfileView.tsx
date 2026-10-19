import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { WhatsAppStatus, GmailStatus, SessionDevice } from '../../types';
import {
  MessageSquare,
  Mail,
  Smartphone,
  LogOut,
  Moon,
  Sun,
  Sliders,
  Bell,
  Calendar,
  Contact,
  RefreshCw,
  Server,
  Repeat,
  ChevronRight,
  Pencil,
  BadgeCheck,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [sessions, setSessions] = useState<SessionDevice[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.getWhatsAppStatus().then(setWaStatus),
      api.getGmailStatus().then(setGmailStatus),
      api.getSessions().then(setSessions),
    ]);
  }, []);

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Perfil</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Conta, autonomia e integrações
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* User Card */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] flex items-center justify-center text-lg font-bold shadow-md shrink-0">
                {user?.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'AV'}
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span>{user?.name?.toUpperCase() || 'ANDRÉ VICTOR'}</span>
                  <BadgeCheck size={16} className="text-[#10B981] fill-current" />
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {user?.email || 'victorandre280@gmail.com'}
                </p>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <span>{user?.phone || '+55 (98) 98441-7165'}</span>
                  <Pencil size={11} className="text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-white" />
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#222730] text-xs font-bold tracking-wider uppercase shadow-sm">
              PRO AI
            </span>
          </div>

          {/* Grupo 1: Assistente Executivo & IA */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
              ASSISTENTE EXECUTIVO & IA
            </h4>

            <div className="rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm divide-y divide-zinc-100 dark:divide-[#222730]/60 overflow-hidden">
              {/* Tema da Interface */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    {isDark ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Tema da Interface</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {isDark ? 'Modo Escuro (M3 Dark)' : 'Modo Claro (M3 Light)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>{isDark ? 'Escuro' : 'Claro'}</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Autonomia do Vito */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Sliders size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Autonomia do Vito</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Proativo em radares e sugestões</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>Nível Alto</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Notificações */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Notificações</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Resumos às 08:30 e alertas críticos</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>Off</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Sincronização de Calendários */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Sincronização de Calendários</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Google Calendar e calendário local</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>1 ativo</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Agenda de Contatos */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Contact size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Agenda de Contatos</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Encontrar colegas e amigos no Vito</p>
                  </div>
                </div>

                <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* WhatsApp */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">WhatsApp</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Sessão ativa e pronto para receber @vito
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-1 text-xs font-medium ${waStatus?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
                  <span>{waStatus?.connected ? 'Conectado' : 'Conectar'}</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Gmail */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Gmail</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {gmailStatus?.email ? `Varredura ativa (${gmailStatus.email})` : `Varredura ativa (${user?.email || 'victorandre280@gmail.com'})`}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-1 text-xs font-medium ${gmailStatus?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
                  <span>{gmailStatus?.connected ? 'Conectado' : 'Configurar'}</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Grupo 2: Sistema & Sessão */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
              SISTEMA & SESSÃO
            </h4>

            <div className="rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm divide-y divide-zinc-100 dark:divide-[#222730]/60 overflow-hidden">
              {/* Dispositivos Conectados */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Dispositivos Conectados</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Gerenciar sessões e acessos ativos</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>{sessions.length || 2} ativos</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Buscar Atualizações */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <RefreshCw size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Buscar Atualizações</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Versão 0.1.11 • Build 11</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Atualizado</span>
                  <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Servidor Conectado */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Server size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Servidor Conectado</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">vitoassistant.rasppi.cloud</p>
                  </div>
                </div>
              </div>

              {/* Trocar de Conta */}
              <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#1C2026] text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                    <Repeat size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">Trocar de Conta</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Alternar workspace ou perfil</p>
                  </div>
                </div>

                <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* Encerrar Sessão */}
              <button
                type="button"
                onClick={logout}
                className="w-full p-4 flex items-center justify-between hover:bg-red-500/5 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                    <LogOut size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-red-500">Encerrar Sessão</p>
                  </div>
                </div>

                <ChevronRight size={14} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
