import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { WhatsAppStatus, GmailStatus, SessionDevice } from '../../types';
import { User, MessageSquare, Mail, Smartphone, Shield, LogOut, CheckCircle2 } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, logout } = useAuth();
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
    <div className="flex-1 h-screen flex flex-col bg-[#0B0D10] overflow-hidden select-none">
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#14171C]">
        <div className="flex items-center gap-3">
          <User size={20} className="text-indigo-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Perfil & Integrações</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
        {/* User Card */}
        <div className="p-6 bg-[#14171C] border border-white/10 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-lg font-bold text-white">
              {user?.name?.slice(0, 1).toUpperCase() || 'V'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{user?.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                  Modo {user?.ai_autonomy_mode === 'proactive' ? 'Proativo' : 'Assistido'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-xl transition-colors"
          >
            <LogOut size={14} />
            <span>Encerrar Sessão</span>
          </button>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Card */}
          <div className="p-5 bg-[#14171C] border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0B3322] text-[#10B981] flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">WhatsApp</h4>
                  <p className="text-[10px] text-slate-400">Evolution API v2</p>
                </div>
              </div>

              {waStatus?.status === 'connected' ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-white/5 px-2 py-0.5 rounded-full">
                  Não conectado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Responde a mensagens de voz (Whisper), áudio e menções @vito em grupos diretamente pelo seu número pessoal.
            </p>
          </div>

          {/* Gmail Card */}
          <div className="p-5 bg-[#14171C] border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Gmail</h4>
                  <p className="text-[10px] text-slate-400">Google OAuth2</p>
                </div>
              </div>

              {gmailStatus?.connected ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} /> {gmailStatus.email || 'Conectado'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-white/5 px-2 py-0.5 rounded-full">
                  Não conectado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Varredura de boletos, faturas e confirmações de voo na Caixa Principal com enriquecimento automático do chat.
            </p>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-5 bg-[#14171C] border border-white/10 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-indigo-400" />
              <h4 className="text-xs font-bold text-white">Dispositivos Conectados (Dual Token)</h4>
            </div>
            <span className="text-[11px] text-slate-400">{sessions.length} ativo(s)</span>
          </div>

          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3 bg-[#0B0D10] border border-white/5 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={16} className="text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      {sess.device_name || 'Navegador Web Desktop'}
                      {sess.is_current && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                          Este Aparelho
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">IP: {sess.ip_address}</p>
                  </div>
                </div>

                {!sess.is_current && (
                  <button
                    onClick={() => api.revokeSession(sess.id).then(() => setSessions((s) => s.filter((x) => x.id !== sess.id)))}
                    className="text-[11px] text-rose-400 hover:text-rose-300"
                  >
                    Desconectar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
