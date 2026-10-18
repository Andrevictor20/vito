import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { VitoLogo } from '../common/VitoLogo';
import { GoogleIcon } from '../common/GoogleIcon';
import { WhatsAppAuthModal } from './WhatsAppAuthModal';
import { Eye, EyeOff, MessageSquare, Loader2, Sun, Moon, AlertCircle, RefreshCw } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhatsAppAuth, setShowWhatsAppAuth] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !password || (isRegister && !cleanName)) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(cleanName, cleanEmail, password);
      } else {
        await login(cleanEmail, password);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('Network') ||
        msg.includes('fetch') ||
        msg.includes('Failed') ||
        msg.includes('esgotado') ||
        msg.includes('AbortError')
      ) {
        setError('Falha ao conectar no servidor. Verifique sua conexão com a internet.');
      } else {
        setError(msg || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError(null);
    const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/callback`);
    // Rota canônica oficial do backend Go: /api/v1/auth/google/start
    window.location.href = `/api/v1/auth/google/start?mode=login&redirect_scheme=${redirectUrl}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D10] p-6 relative select-none">
      {/* Background ambient lighting (Dark OLED) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full" />

      {/* Card M3 Filled/Elevated (Surface Container, 28px radius) */}
      <div className="w-full max-w-[400px] bg-[#14171C] border border-[#222730] rounded-[28px] p-8 shadow-[0_6px_28px_rgba(0,0,0,0.5)] z-10">
        {/* Top Header Row com VitoLogo e Theme Switcher */}
        <div className="flex items-center justify-between mb-2">
          <VitoLogo size="small" />

          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1C2026] border border-[#222730] text-zinc-300 hover:text-white transition-colors"
            title={isDark ? 'Tema claro' : 'Tema escuro'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Subtítulo idêntico ao mobile */}
        <p className="text-sm text-zinc-400 mb-6">
          {isRegister ? 'Crie sua conta pessoal' : 'Seu secretário executivo pessoal com IA'}
        </p>

        {/* Error Feedback Box */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1 leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                placeholder="Ex: André Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 rounded-lg bg-[#0B0D10] border border-[#222730] text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoCapitalize="none"
              className="w-full h-12 px-4 rounded-lg bg-[#0B0D10] border border-[#222730] text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-12 pl-4 pr-11 rounded-lg bg-[#0B0D10] border border-[#222730] text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão M3 Filled Primary Full-Pill */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#09090B]" />
            ) : isRegister ? (
              'Criar Conta'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Divisor Visual "ou" */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-[#222730]" />
          <span className="text-xs text-zinc-500 font-medium">ou</span>
          <div className="flex-1 h-[1px] bg-[#222730]" />
        </div>

        {/* Botão de Autenticação com a Conta Google (Outlined Full-Pill) */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-11 rounded-full border border-[#222730] hover:border-zinc-500 bg-transparent text-white font-medium text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <GoogleIcon size={18} />
          <span>Continuar com o Google</span>
        </button>

        {/* Botão de Autenticação via WhatsApp (Outlined Full-Pill com ícone verde) */}
        <button
          type="button"
          onClick={() => setShowWhatsAppAuth(true)}
          disabled={loading}
          className="w-full h-11 rounded-full border border-[#222730] hover:border-zinc-500 bg-transparent text-white font-medium text-sm transition-all flex items-center justify-center gap-3 mt-3 disabled:opacity-50"
        >
          <MessageSquare className="w-4 h-4 text-[#25D366]" />
          <span>Entrar com WhatsApp</span>
        </button>

        {/* Alternador de Modo (Texto limpo) */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {isRegister
              ? 'Já possui uma conta? Faça login'
              : 'Não tem conta? Cadastre-se em instantes'}
          </button>
        </div>

        {/* Rodapé com Versão e Status */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-[#222730]/60 text-[11px] text-zinc-500">
          <span>Build: v0.1.3</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <RefreshCw className="w-3 h-3 text-[#10B981]" />
            <span>Sincronizado</span>
          </div>
        </div>
      </div>

      {/* Modal de Autenticação OTP por WhatsApp */}
      <WhatsAppAuthModal
        isOpen={showWhatsAppAuth}
        onClose={() => setShowWhatsAppAuth(false)}
      />
    </div>
  );
};
