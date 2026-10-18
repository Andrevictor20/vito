import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Mail, MessageSquare, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, loginWithWhatsApp } = useAuth();
  const [tab, setTab] = useState<'password' | 'whatsapp'>('password');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // WhatsApp form
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Nome é obrigatório');
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) throw new Error('Informe um número de WhatsApp válido com DDD');
      await api.requestWhatsAppOTP(cleanPhone);
      setOtpRequested(true);
    } catch (err: any) {
      setError(err.message || 'Falha ao solicitar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithWhatsApp(phone.replace(/\D/g, ''), otpCode.trim());
    } catch (err: any) {
      setError(err.message || 'Código OTP inválido ou expirado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/callback`);
    window.location.href = `https://vito.rasppi.cloud/api/v1/auth/google?redirect_uri=${redirectUrl}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D10] p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-[#14171C] border border-white/10 rounded-2xl shadow-modal p-8 z-10 backdrop-blur-xl">
        {/* Mascot Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#1C2026] border border-white/10 flex items-center justify-center text-2xl shadow-glow-primary mb-4">
            🎩
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Vito Desktop
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Pro
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Seu assistente executivo autônomo e focado
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-[#0B0D10] border border-white/5 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setTab('password'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'password'
                ? 'bg-[#1C2026] text-white shadow-sm border border-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail size={14} />
            E-mail & Senha
          </button>
          <button
            type="button"
            onClick={() => { setTab('whatsapp'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'whatsapp'
                ? 'bg-[#0B3322] text-[#34D399] shadow-sm border border-[#10B981]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            WhatsApp OTP
          </button>
        </div>

        {error && (
          <div className="p-3 mb-5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 animate-shake">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form: Password / Email */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="André Victor"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#0B0D10] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0D10] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 bg-[#0B0D10] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Criar Conta' : 'Acessar Workspace'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(null); }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {isRegister ? 'Já possui conta? Entrar' : 'Novo por aqui? Criar conta'}
              </button>
            </div>
          </form>
        )}

        {/* Form: WhatsApp OTP */}
        {tab === 'whatsapp' && (
          <div>
            {!otpRequested ? (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Número do WhatsApp (com DDD)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11999999999"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#0B0D10] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Enviaremos um código de 6 dígitos no seu WhatsApp para acesso sem senha.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <span>Enviar Código no WhatsApp</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 size={16} />
                  <span>Código enviado para {phone}!</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Código de 6 Dígitos</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full text-center tracking-[0.5em] px-3.5 py-2.5 bg-[#0B0D10] border border-white/10 rounded-lg text-lg text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <span>Confirmar e Entrar</span>}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setOtpRequested(false); setOtpCode(''); }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Alterar número
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">ou</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 px-4 bg-[#1C2026] hover:bg-[#262B33] active:bg-[#14171C] border border-white/10 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2.5 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar com o Google</span>
        </button>
      </div>
    </div>
  );
};
